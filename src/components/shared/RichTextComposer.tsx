import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  Link2,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Code,
  Type,
  ChevronDown,
  FileText,
  Image,
  Video,
  Paperclip,
  MousePointer2,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TemplateListModal } from "@/components/templates/TemplateListModal";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type EmailTemplate = Tables<"email_templates">;

interface RichTextComposerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  compact?: boolean;
  showTemplates?: boolean;
  showMergeTags?: boolean;
  showModeToggle?: boolean;
  onTemplateSelect?: (template: EmailTemplate) => void;
  className?: string;
}

const mergeTags = [
  { tag: "{{first_name}}", label: "First Name" },
  { tag: "{{last_name}}", label: "Last Name" },
  { tag: "{{email}}", label: "Email" },
  { tag: "{{company}}", label: "Company" },
];

const ctaStyles: Record<string, { bg: string; text: string; label: string; border?: string }> = {
  primary: { bg: "#3b82f6", text: "#ffffff", label: "Primary (Blue)" },
  secondary: { bg: "#6b7280", text: "#ffffff", label: "Secondary (Gray)" },
  success: { bg: "#10b981", text: "#ffffff", label: "Success (Green)" },
  danger: { bg: "#ef4444", text: "#ffffff", label: "Danger (Red)" },
  outline: { bg: "transparent", text: "#3b82f6", border: "#3b82f6", label: "Outline (Blue)" },
};

export function RichTextComposer({
  value,
  onChange,
  placeholder = "Write your message...",
  minHeight = 100,
  maxHeight = 300,
  compact = false,
  showTemplates = true,
  showMergeTags = true,
  showModeToggle = false,
  onTemplateSelect,
  className,
}: RichTextComposerProps) {
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  
  // Link dialog state - selection aware
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const [savedSelection, setSavedSelection] = useState<Range | null>(null);
  const [trackLinkClicks, setTrackLinkClicks] = useState(false);
  
  // Image dialog state with upload
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageTab, setImageTab] = useState<"upload" | "url">("upload");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  
  // Image link dialog (click on image to add link)
  const [imageLinkDialogOpen, setImageLinkDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [imageLinkUrl, setImageLinkUrl] = useState("");
  const [trackImageClicks, setTrackImageClicks] = useState(false);
  
  // Video dialog state with upload
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTab, setVideoTab] = useState<"upload" | "url">("upload");
  
  // Attachment dialog state
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  
  // CTA Button dialog state
  const [ctaDialogOpen, setCtaDialogOpen] = useState(false);
  const [ctaText, setCtaText] = useState("Get Started");
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaStyle, setCtaStyle] = useState<keyof typeof ctaStyles>("primary");
  const [trackCtaClicks, setTrackCtaClicks] = useState(true);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  // Track if user is actively editing to prevent external updates from destroying cursor
  const isFocusedRef = useRef(false);
  const lastValueRef = useRef(value);
  const savedCursorRangeRef = useRef<Range | null>(null);

  // Extract body content from full HTML documents for safe rendering in contentEditable
  const extractBodyContent = (html: string): string => {
    // Check if this looks like a full HTML document
    if (/<html[\s>]/i.test(html) || /<!DOCTYPE/i.test(html)) {
      // Try to extract body content
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch && bodyMatch[1]) {
        return bodyMatch[1].trim();
      }
      // If no body tag but has html tag, try to extract content after head
      const htmlMatch = html.match(/<html[^>]*>([\s\S]*)<\/html>/i);
      if (htmlMatch) {
        // Remove head section and return the rest
        const content = htmlMatch[1].replace(/<head[\s\S]*?<\/head>/gi, '').trim();
        return content;
      }
    }
    return html;
  };

  // Sync external value changes to editor - but NOT while user is editing
  useEffect(() => {
    if (editorRef.current && mode === "visual" && !isFocusedRef.current) {
      // Extract body content if full HTML document was pasted
      const safeHtml = extractBodyContent(value);
      if (editorRef.current.innerHTML !== safeHtml) {
        editorRef.current.innerHTML = safeHtml;
      }
    }
    lastValueRef.current = value;
  }, [value, mode]);

  // Save cursor position before opening dialogs
  const saveCursorPosition = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedCursorRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  }, []);

  // Restore cursor and focus editor before inserting content
  const restoreCursorAndFocus = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.focus();
      if (savedCursorRangeRef.current) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedCursorRangeRef.current);
      }
    }
  }, []);

  const execCommand = useCallback((command: string, cmdValue?: string) => {
    restoreCursorAndFocus();
    document.execCommand(command, false, cmdValue);
    if (editorRef.current) {
      const newValue = editorRef.current.innerHTML;
      lastValueRef.current = newValue;
      onChange(newValue);
    }
  }, [onChange, restoreCursorAndFocus]);

  const handleFormat = (format: string) => {
    switch (format) {
      case "bold": execCommand("bold"); break;
      case "italic": execCommand("italic"); break;
      case "underline": execCommand("underline"); break;
      case "h1": execCommand("formatBlock", "h1"); break;
      case "h2": execCommand("formatBlock", "h2"); break;
      case "ul": execCommand("insertUnorderedList"); break;
      case "ol": execCommand("insertOrderedList"); break;
    }
  };

  // Selection-aware link insertion
  const handleLinkButtonClick = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      setSavedSelection(range.cloneRange());
      setLinkText(selection.toString());
      setHasTextSelection(true);
    } else {
      setSavedSelection(null);
      setLinkText("");
      setHasTextSelection(false);
    }
    setLinkUrl("");
    setTrackLinkClicks(false);
    setLinkDialogOpen(true);
  };

  const handleInsertLink = () => {
    if (!linkUrl) return;
    
    if (hasTextSelection && savedSelection) {
      // Restore selection and wrap with link
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedSelection);
      document.execCommand('createLink', false, linkUrl);
      
      // If tracking enabled, add data attribute
      if (trackLinkClicks && editorRef.current) {
        const links = editorRef.current.querySelectorAll(`a[href="${linkUrl}"]`);
        links.forEach(link => {
          link.setAttribute('data-track-clicks', 'true');
        });
      }
    } else {
      // Insert new link at cursor
      const text = linkText || linkUrl;
      const trackAttr = trackLinkClicks ? ' data-track-clicks="true"' : '';
      const linkHtml = `<a href="${linkUrl}"${trackAttr}>${text}</a>`;
      execCommand("insertHTML", linkHtml);
    }
    
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    
    setLinkDialogOpen(false);
    setLinkUrl("");
    setLinkText("");
    setSavedSelection(null);
    setHasTextSelection(false);
    setTrackLinkClicks(false);
  };

  // File upload to Supabase Storage
  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data, error } = await supabase.storage
        .from('email-attachments')
        .upload(fileName, file);

      if (error) {
        console.error('Upload error:', error);
        toast.error('Failed to upload file');
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('email-attachments')
        .getPublicUrl(data.path);
      
      return urlData.publicUrl;
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload file');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleImageFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    
    const url = await uploadFile(file);
    if (url) {
      setImageUrl(url);
      toast.success('Image uploaded successfully');
    }
  };

  const handleVideoFileSelect = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Video size must be less than 50MB');
      return;
    }
    
    const url = await uploadFile(file);
    if (url) {
      setVideoUrl(url);
      toast.success('Video uploaded successfully');
    }
  };

  const handleInsertImage = () => {
    if (imageUrl) {
      const imgHtml = `<img src="${imageUrl}" alt="${imageAlt || 'Image'}" style="max-width: 100%; height: auto; cursor: pointer;" data-clickable="true" />`;
      execCommand("insertHTML", imgHtml);
    }
    setImageDialogOpen(false);
    setImageUrl("");
    setImageAlt("");
    setImageTab("upload");
  };

  // Handle clicking on image in editor to add link
  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      e.preventDefault();
      setSelectedImage(target as HTMLImageElement);
      
      // Check if image already has a link
      const parent = target.parentElement;
      if (parent?.tagName === 'A') {
        setImageLinkUrl((parent as HTMLAnchorElement).href);
        setTrackImageClicks(parent.hasAttribute('data-track-clicks'));
      } else {
        setImageLinkUrl("");
        setTrackImageClicks(false);
      }
      
      setImageLinkDialogOpen(true);
    }
  };

  const handleAddLinkToImage = () => {
    if (!selectedImage || !editorRef.current) return;
    
    const parent = selectedImage.parentElement;
    
    if (imageLinkUrl) {
      const trackAttr = trackImageClicks ? ' data-track-clicks="true"' : '';
      
      if (parent?.tagName === 'A') {
        // Update existing link
        (parent as HTMLAnchorElement).href = imageLinkUrl;
        if (trackImageClicks) {
          parent.setAttribute('data-track-clicks', 'true');
        } else {
          parent.removeAttribute('data-track-clicks');
        }
      } else {
        // Wrap image in new link
        const link = document.createElement('a');
        link.href = imageLinkUrl;
        link.target = '_blank';
        if (trackImageClicks) {
          link.setAttribute('data-track-clicks', 'true');
        }
        selectedImage.parentNode?.insertBefore(link, selectedImage);
        link.appendChild(selectedImage);
      }
    } else if (parent?.tagName === 'A') {
      // Remove existing link
      parent.parentNode?.insertBefore(selectedImage, parent);
      parent.remove();
    }
    
    onChange(editorRef.current.innerHTML);
    setImageLinkDialogOpen(false);
    setSelectedImage(null);
    setImageLinkUrl("");
    setTrackImageClicks(false);
  };

  const handleRemoveLinkFromImage = () => {
    if (!selectedImage || !editorRef.current) return;
    
    const parent = selectedImage.parentElement;
    if (parent?.tagName === 'A') {
      parent.parentNode?.insertBefore(selectedImage, parent);
      parent.remove();
      onChange(editorRef.current.innerHTML);
    }
    
    setImageLinkDialogOpen(false);
    setSelectedImage(null);
    setImageLinkUrl("");
  };

  const handleInsertVideo = () => {
    if (videoUrl) {
      let embedHtml = "";
      
      const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
      if (ytMatch) {
        embedHtml = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="max-width: 100%;"></iframe>`;
      } else if (videoUrl.includes("vimeo.com")) {
        const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) {
          embedHtml = `<iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" width="560" height="315" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="max-width: 100%;"></iframe>`;
        }
      } else {
        embedHtml = `<video src="${videoUrl}" controls style="max-width: 100%;"></video>`;
      }
      
      if (embedHtml) {
        execCommand("insertHTML", embedHtml);
      }
    }
    setVideoDialogOpen(false);
    setVideoUrl("");
    setVideoTab("upload");
  };

  const handleInsertAttachment = () => {
    if (attachmentUrl) {
      const attachHtml = `<a href="${attachmentUrl}" download class="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm">📎 ${attachmentName || 'Attachment'}</a>`;
      execCommand("insertHTML", attachHtml);
    }
    setAttachmentDialogOpen(false);
    setAttachmentUrl("");
    setAttachmentName("");
  };

  // CTA Button insertion
  const handleInsertCTA = () => {
    if (!ctaUrl || !ctaText) return;
    
    const style = ctaStyles[ctaStyle];
    const borderStyle = style.border ? `border: 2px solid ${style.border};` : '';
    const trackAttr = trackCtaClicks ? ' data-track-clicks="true"' : '';
    
    const buttonHtml = `<a href="${ctaUrl}" target="_blank"${trackAttr} style="display: inline-block; padding: 12px 24px; background-color: ${style.bg}; color: ${style.text}; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; ${borderStyle} margin: 8px 0;">${ctaText}</a>`;
    
    execCommand("insertHTML", buttonHtml);
    
    setCtaDialogOpen(false);
    setCtaText("Get Started");
    setCtaUrl("");
    setCtaStyle("primary");
    setTrackCtaClicks(true);
  };

  const handleInsertMergeTag = (tag: string) => {
    execCommand("insertHTML", tag);
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      const newValue = editorRef.current.innerHTML;
      lastValueRef.current = newValue;
      onChange(newValue);
    }
  };

  const handleEditorFocus = () => {
    isFocusedRef.current = true;
  };

  const handleEditorBlur = () => {
    isFocusedRef.current = false;
  };

  const handleHtmlChange = (html: string) => {
    onChange(html);
  };

  const handleTemplateSelect = (template: EmailTemplate) => {
    const content = template.body_html || template.body_text || "";
    if (editorRef.current) {
      editorRef.current.innerHTML = content;
    }
    onChange(content);
    onTemplateSelect?.(template);
    setTemplateModalOpen(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await handleImageFileSelect(file);
    }
  };

  const buttonSize = compact ? "h-6 w-6" : "h-7 w-7";
  const iconSize = compact ? "h-3 w-3" : "h-3.5 w-3.5";

  const toolbar = (
    <div className="flex items-center gap-0.5 flex-wrap">
      <Button type="button" variant="ghost" size="icon" className={buttonSize} onClick={() => handleFormat("bold")} title="Bold">
        <Bold className={iconSize} />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={buttonSize} onClick={() => handleFormat("italic")} title="Italic">
        <Italic className={iconSize} />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={buttonSize} onClick={() => handleFormat("underline")} title="Underline">
        <Underline className={iconSize} />
      </Button>

      {!compact && (
        <>
          <div className="w-px h-4 bg-border mx-1" />
          <Button type="button" variant="ghost" size="icon" className={buttonSize} onClick={() => handleFormat("h1")} title="Heading 1">
            <Heading1 className={iconSize} />
          </Button>
          <Button type="button" variant="ghost" size="icon" className={buttonSize} onClick={() => handleFormat("h2")} title="Heading 2">
            <Heading2 className={iconSize} />
          </Button>
        </>
      )}

      <div className="w-px h-4 bg-border mx-1" />

      <Button type="button" variant="ghost" size="icon" className={buttonSize} onClick={() => handleFormat("ul")} title="Bullet List">
        <List className={iconSize} />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={buttonSize} onClick={() => handleFormat("ol")} title="Numbered List">
        <ListOrdered className={iconSize} />
      </Button>

      <div className="w-px h-4 bg-border mx-1" />

      <Button type="button" variant="ghost" size="icon" className={buttonSize} onClick={handleLinkButtonClick} title="Insert Link (select text first to wrap)">
        <Link2 className={iconSize} />
      </Button>
      
      <Button type="button" variant="ghost" size="icon" className={buttonSize} onClick={() => { saveCursorPosition(); setImageDialogOpen(true); }} title="Insert Image">
        <Image className={iconSize} />
      </Button>
      
      <Button type="button" variant="ghost" size="icon" className={buttonSize} onClick={() => { saveCursorPosition(); setVideoDialogOpen(true); }} title="Insert Video">
        <Video className={iconSize} />
      </Button>
      
      <Button type="button" variant="ghost" size="icon" className={buttonSize} onClick={() => { saveCursorPosition(); setAttachmentDialogOpen(true); }} title="Insert Attachment Link">
        <Paperclip className={iconSize} />
      </Button>
      
      <Button type="button" variant="ghost" size="icon" className={buttonSize} onClick={() => { saveCursorPosition(); setCtaDialogOpen(true); }} title="Insert CTA Button">
        <MousePointer2 className={iconSize} />
      </Button>

      {showTemplates && (
        <Button type="button" variant="ghost" size="sm" className={compact ? "h-6 text-xs gap-1 px-2" : "h-7 text-xs gap-1"} onClick={() => setTemplateModalOpen(true)} title="Use Template">
          <FileText className={iconSize} />
          {!compact && "Templates"}
        </Button>
      )}

      {showMergeTags && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className={compact ? "h-6 text-xs gap-1 px-2" : "h-7 text-xs gap-1"}>
              {compact ? <ChevronDown className="h-3 w-3" /> : (<>Merge Tags<ChevronDown className="h-3 w-3" /></>)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {mergeTags.map((item) => (
              <DropdownMenuItem key={item.tag} onClick={() => handleInsertMergeTag(item.tag)}>
                <code className="text-xs mr-2">{item.tag}</code>
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return (
    <div className={className}>
      {showModeToggle ? (
        <Tabs value={mode} onValueChange={(v) => setMode(v as "visual" | "html")}>
          <div className="flex items-center justify-between border-b pb-2 mb-2">
            <TabsList className="h-7">
              <TabsTrigger value="visual" className="text-xs gap-1">
                <Type className="h-3 w-3" />
                Visual
              </TabsTrigger>
              <TabsTrigger value="html" className="text-xs gap-1">
                <Code className="h-3 w-3" />
                HTML
              </TabsTrigger>
            </TabsList>
            {mode === "visual" && toolbar}
          </div>

          <TabsContent value="visual" className="mt-0">
            <div
              ref={editorRef}
              contentEditable
              className="p-3 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring prose prose-sm max-w-none dark:prose-invert overflow-auto"
              onInput={handleEditorInput}
              onClick={handleEditorClick}
              onFocus={handleEditorFocus}
              onBlur={handleEditorBlur}
              style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px`, whiteSpace: "pre-wrap" }}
              data-placeholder={placeholder}
            />
          </TabsContent>

          <TabsContent value="html" className="mt-0">
            <textarea
              value={value}
              onChange={(e) => handleHtmlChange(e.target.value)}
              className="w-full p-3 border rounded-md bg-muted/50 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              placeholder="<p>Enter your HTML here...</p>"
              style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <div>
          <div className="flex items-center border-b pb-2 mb-2">{toolbar}</div>
          <div
            ref={editorRef}
            contentEditable
            className="p-3 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring prose prose-sm max-w-none dark:prose-invert overflow-auto"
            onInput={handleEditorInput}
            onClick={handleEditorClick}
            onFocus={handleEditorFocus}
            onBlur={handleEditorBlur}
            style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px`, whiteSpace: "pre-wrap" }}
            data-placeholder={placeholder}
          />
        </div>
      )}

      {/* Link Dialog - Selection Aware */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hasTextSelection ? "Link Selected Text" : "Insert Link"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {hasTextSelection && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Selected text:</p>
                <p className="font-medium text-sm">"{linkText}"</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="composer-link-url">URL</Label>
              <Input
                id="composer-link-url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
            {!hasTextSelection && (
              <div className="space-y-2">
                <Label htmlFor="composer-link-text">Link Text</Label>
                <Input
                  id="composer-link-text"
                  placeholder="Click here"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                />
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Checkbox id="track-link" checked={trackLinkClicks} onCheckedChange={(c) => setTrackLinkClicks(!!c)} />
              <Label htmlFor="track-link" className="text-sm">Track clicks</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInsertLink} disabled={!linkUrl}>Insert Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog with Upload */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
          </DialogHeader>
          <Tabs value={imageTab} onValueChange={(v) => setImageTab(v as "upload" | "url")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="url">From URL</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </div>
                ) : imageUrl ? (
                  <div className="space-y-3">
                    <img src={imageUrl} alt="Preview" className="max-h-32 mx-auto rounded" />
                    <Button variant="outline" size="sm" onClick={() => setImageUrl("")}>
                      <X className="h-4 w-4 mr-1" /> Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Drop an image here or</p>
                      <Button variant="link" className="p-0 h-auto" onClick={() => fileInputRef.current?.click()}>
                        click to browse
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Max size: 10MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageFileSelect(e.target.files[0])}
                />
              </div>
            </TabsContent>
            <TabsContent value="url" className="space-y-4">
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input placeholder="https://example.com/image.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              </div>
              {imageUrl && (
                <div className="p-2 border rounded bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                  <img src={imageUrl} alt="Preview" className="max-h-32 object-contain" />
                </div>
              )}
            </TabsContent>
          </Tabs>
          <div className="space-y-2">
            <Label>Alt Text (optional)</Label>
            <Input placeholder="Image description" value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImageDialogOpen(false); setImageUrl(""); setImageAlt(""); }}>Cancel</Button>
            <Button onClick={handleInsertImage} disabled={!imageUrl}>Insert Image</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Link Dialog (click on image to add link) */}
      <Dialog open={imageLinkDialogOpen} onOpenChange={setImageLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Link to Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedImage && (
              <div className="p-3 bg-muted rounded-md flex justify-center">
                <img src={selectedImage.src} alt="" className="max-h-24 rounded" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Link URL</Label>
              <Input placeholder="https://example.com" value={imageLinkUrl} onChange={(e) => setImageLinkUrl(e.target.value)} />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="track-image-clicks" checked={trackImageClicks} onCheckedChange={(c) => setTrackImageClicks(!!c)} />
              <Label htmlFor="track-image-clicks" className="text-sm">Track clicks</Label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedImage?.parentElement?.tagName === 'A' && (
              <Button variant="destructive" onClick={handleRemoveLinkFromImage} className="sm:mr-auto">Remove Link</Button>
            )}
            <Button variant="outline" onClick={() => setImageLinkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddLinkToImage}>{imageLinkUrl ? "Apply Link" : "Close"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Dialog with Upload */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Video</DialogTitle>
          </DialogHeader>
          <Tabs value={videoTab} onValueChange={(v) => setVideoTab(v as "upload" | "url")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="url">From URL</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </div>
                ) : videoUrl && !videoUrl.includes('youtube') && !videoUrl.includes('vimeo') ? (
                  <div className="space-y-3">
                    <video src={videoUrl} className="max-h-32 mx-auto rounded" controls />
                    <Button variant="outline" size="sm" onClick={() => setVideoUrl("")}>
                      <X className="h-4 w-4 mr-1" /> Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Drop a video here or</p>
                      <Button variant="link" className="p-0 h-auto" onClick={() => videoInputRef.current?.click()}>
                        click to browse
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Max size: 50MB</p>
                  </div>
                )}
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleVideoFileSelect(e.target.files[0])}
                />
              </div>
            </TabsContent>
            <TabsContent value="url" className="space-y-4">
              <div className="space-y-2">
                <Label>Video URL</Label>
                <Input placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                <p className="text-xs text-muted-foreground">Supports YouTube, Vimeo, or direct video URLs</p>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVideoDialogOpen(false); setVideoUrl(""); }}>Cancel</Button>
            <Button onClick={handleInsertVideo} disabled={!videoUrl}>Insert Video</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachment Dialog */}
      <Dialog open={attachmentDialogOpen} onOpenChange={setAttachmentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Attachment Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>File URL</Label>
              <Input placeholder="https://example.com/document.pdf" value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Display Name (optional)</Label>
              <Input placeholder="Document.pdf" value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachmentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInsertAttachment} disabled={!attachmentUrl}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CTA Button Dialog */}
      <Dialog open={ctaDialogOpen} onOpenChange={setCtaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert CTA Button</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Button Text</Label>
              <Input placeholder="Get Started" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Link URL</Label>
              <Input placeholder="https://example.com/signup" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Style</Label>
              <Select value={ctaStyle} onValueChange={(v) => setCtaStyle(v as keyof typeof ctaStyles)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ctaStyles).map(([key, style]) => (
                    <SelectItem key={key} value={key}>{style.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="p-4 bg-muted rounded-md flex justify-center">
                <span
                  style={{
                    display: 'inline-block',
                    padding: '12px 24px',
                    backgroundColor: ctaStyles[ctaStyle].bg,
                    color: ctaStyles[ctaStyle].text,
                    textDecoration: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '14px',
                    border: ctaStyles[ctaStyle].border ? `2px solid ${ctaStyles[ctaStyle].border}` : 'none',
                  }}
                >
                  {ctaText || "Button"}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="track-cta" checked={trackCtaClicks} onCheckedChange={(c) => setTrackCtaClicks(!!c)} />
              <Label htmlFor="track-cta" className="text-sm">Track clicks</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCtaDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInsertCTA} disabled={!ctaUrl || !ctaText}>Insert Button</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Modal */}
      <TemplateListModal
        open={templateModalOpen}
        onOpenChange={setTemplateModalOpen}
        onSelectTemplate={handleTemplateSelect}
      />
    </div>
  );
}
