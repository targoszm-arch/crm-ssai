import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Eye,
  Type,
  ChevronDown,
  Image,
  Video,
  Paperclip,
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

interface EmailTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const mergeTags = [
  { tag: "{{first_name}}", label: "First Name" },
  { tag: "{{last_name}}", label: "Last Name" },
  { tag: "{{email}}", label: "Email" },
  { tag: "{{company}}", label: "Company" },
];

export function EmailTemplateEditor({ value, onChange, className }: EmailTemplateEditorProps) {
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  
  // Image dialog state
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  
  // Video dialog state
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  
  // Attachment dialog state
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  
  const editorRef = useRef<HTMLDivElement>(null);

  const execCommand = useCallback((command: string, cmdValue?: string) => {
    document.execCommand(command, false, cmdValue);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleFormat = (format: string) => {
    switch (format) {
      case "bold":
        execCommand("bold");
        break;
      case "italic":
        execCommand("italic");
        break;
      case "underline":
        execCommand("underline");
        break;
      case "h1":
        execCommand("formatBlock", "h1");
        break;
      case "h2":
        execCommand("formatBlock", "h2");
        break;
      case "ul":
        execCommand("insertUnorderedList");
        break;
      case "ol":
        execCommand("insertOrderedList");
        break;
    }
  };

  const handleInsertLink = () => {
    if (linkUrl) {
      const linkHtml = linkText 
        ? `<a href="${linkUrl}">${linkText}</a>`
        : `<a href="${linkUrl}">${linkUrl}</a>`;
      execCommand("insertHTML", linkHtml);
    }
    setLinkDialogOpen(false);
    setLinkUrl("");
    setLinkText("");
  };

  const handleInsertImage = () => {
    if (imageUrl) {
      const imgHtml = `<img src="${imageUrl}" alt="${imageAlt || 'Image'}" style="max-width: 100%; height: auto;" />`;
      execCommand("insertHTML", imgHtml);
    }
    setImageDialogOpen(false);
    setImageUrl("");
    setImageAlt("");
  };

  const handleInsertVideo = () => {
    if (videoUrl) {
      let embedHtml = "";
      
      // YouTube detection
      const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
      if (ytMatch) {
        embedHtml = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="max-width: 100%;"></iframe>`;
      } 
      // Vimeo detection
      else if (videoUrl.includes("vimeo.com")) {
        const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) {
          embedHtml = `<iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" width="560" height="315" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="max-width: 100%;"></iframe>`;
        }
      }
      // Direct video URL
      else {
        embedHtml = `<video src="${videoUrl}" controls style="max-width: 100%;"></video>`;
      }
      
      if (embedHtml) {
        execCommand("insertHTML", embedHtml);
      }
    }
    setVideoDialogOpen(false);
    setVideoUrl("");
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

  const handleInsertMergeTag = (tag: string) => {
    execCommand("insertHTML", tag);
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleHtmlChange = (html: string) => {
    onChange(html);
  };

  return (
    <div className={className}>
      <Tabs value={mode} onValueChange={(v) => setMode(v as "visual" | "html")}>
        <div className="flex items-center justify-between border-b pb-2 mb-2">
          <TabsList className="h-8">
            <TabsTrigger value="visual" className="text-xs gap-1">
              <Type className="h-3 w-3" />
              Visual
            </TabsTrigger>
            <TabsTrigger value="html" className="text-xs gap-1">
              <Code className="h-3 w-3" />
              HTML
            </TabsTrigger>
          </TabsList>

          {mode === "visual" && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleFormat("bold")}
                title="Bold"
              >
                <Bold className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleFormat("italic")}
                title="Italic"
              >
                <Italic className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleFormat("underline")}
                title="Underline"
              >
                <Underline className="h-3.5 w-3.5" />
              </Button>

              <div className="w-px h-5 bg-border mx-1" />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleFormat("h1")}
                title="Heading 1"
              >
                <Heading1 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleFormat("h2")}
                title="Heading 2"
              >
                <Heading2 className="h-3.5 w-3.5" />
              </Button>

              <div className="w-px h-5 bg-border mx-1" />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleFormat("ul")}
                title="Bullet List"
              >
                <List className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleFormat("ol")}
                title="Numbered List"
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </Button>

              <div className="w-px h-5 bg-border mx-1" />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setLinkDialogOpen(true)}
                title="Insert Link"
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setImageDialogOpen(true)}
                title="Insert Image"
              >
                <Image className="h-3.5 w-3.5" />
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setVideoDialogOpen(true)}
                title="Insert Video"
              >
                <Video className="h-3.5 w-3.5" />
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setAttachmentDialogOpen(true)}
                title="Insert Attachment Link"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    Merge Tags
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {mergeTags.map((item) => (
                    <DropdownMenuItem
                      key={item.tag}
                      onClick={() => handleInsertMergeTag(item.tag)}
                    >
                      <code className="text-xs mr-2">{item.tag}</code>
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <TabsContent value="visual" className="mt-0">
          <div
            ref={editorRef}
            contentEditable
            className="min-h-[300px] p-4 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring prose prose-sm max-w-none dark:prose-invert"
            onInput={handleEditorInput}
            dangerouslySetInnerHTML={{ __html: value }}
            style={{ whiteSpace: "pre-wrap" }}
          />
        </TabsContent>

        <TabsContent value="html" className="mt-0">
          <textarea
            value={value}
            onChange={(e) => handleHtmlChange(e.target.value)}
            className="w-full min-h-[300px] p-4 border rounded-md bg-muted/50 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            placeholder="<p>Enter your HTML here...</p>"
          />
        </TabsContent>
      </Tabs>

      {/* Preview Panel */}
      <div className="mt-4 border-t pt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Eye className="h-4 w-4" />
          Preview
        </div>
        <div
          className="p-4 border rounded-md bg-white dark:bg-muted/20 prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: value }}
        />
      </div>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-link-url">URL</Label>
              <Input
                id="template-link-url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-link-text">Link Text (optional)</Label>
              <Input
                id="template-link-text"
                placeholder="Click here"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsertLink}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-image-url">Image URL</Label>
              <Input
                id="template-image-url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-image-alt">Alt Text (optional)</Label>
              <Input
                id="template-image-alt"
                placeholder="Image description"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
              />
            </div>
            {imageUrl && (
              <div className="mt-2 p-2 border rounded bg-muted/50">
                <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                <img src={imageUrl} alt={imageAlt || 'Preview'} className="max-h-32 object-contain" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsertImage} disabled={!imageUrl}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Dialog */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-video-url">Video URL</Label>
              <Input
                id="template-video-url"
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Supports YouTube, Vimeo, or direct video URLs (.mp4, .webm)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsertVideo} disabled={!videoUrl}>Insert</Button>
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
              <Label htmlFor="template-attach-url">File URL</Label>
              <Input
                id="template-attach-url"
                placeholder="https://example.com/document.pdf"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-attach-name">Display Name (optional)</Label>
              <Input
                id="template-attach-name"
                placeholder="Document.pdf"
                value={attachmentName}
                onChange={(e) => setAttachmentName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsertAttachment} disabled={!attachmentUrl}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
