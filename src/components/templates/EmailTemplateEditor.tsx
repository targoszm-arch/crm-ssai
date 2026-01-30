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
  const editorRef = useRef<HTMLDivElement>(null);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
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
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-text">Link Text (optional)</Label>
              <Input
                id="link-text"
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
    </div>
  );
}
