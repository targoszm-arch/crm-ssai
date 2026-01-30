import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmailTemplateEditor } from "./EmailTemplateEditor";
import {
  EmailTemplate,
  useCreateTemplate,
  useUpdateTemplate,
} from "@/hooks/useEmailTemplates";

interface EditTemplateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: EmailTemplate | null;
}

const categories = [
  { value: "general", label: "General" },
  { value: "welcome", label: "Welcome" },
  { value: "follow_up", label: "Follow Up" },
  { value: "sales", label: "Sales" },
  { value: "meeting", label: "Meeting" },
  { value: "thank_you", label: "Thank You" },
  { value: "newsletter", label: "Newsletter" },
];

export function EditTemplateSheet({ open, onOpenChange, template }: EditTemplateSheetProps) {
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  const isEditing = !!template;

  useEffect(() => {
    if (template) {
      setName(template.name);
      setCategory(template.category || "general");
      setSubject(template.subject || "");
      setBodyHtml(template.body_html || "");
    } else {
      setName("");
      setCategory("general");
      setSubject("");
      setBodyHtml("<p>Start writing your email here...</p>");
    }
  }, [template, open]);

  const handleSave = async () => {
    // Convert HTML to plain text for body_text
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = bodyHtml;
    const bodyText = tempDiv.textContent || tempDiv.innerText || "";

    if (isEditing && template) {
      await updateTemplate.mutateAsync({
        id: template.id,
        name,
        category,
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
      });
    } else {
      await createTemplate.mutateAsync({
        name,
        category,
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
      });
    }

    onOpenChange(false);
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Template" : "Create Template"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modify your email template with the rich text editor."
              : "Create a new email template for use in sequences."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g., Welcome Email"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subject Line */}
          <div className="space-y-2">
            <Label htmlFor="template-subject">Subject Line</Label>
            <Input
              id="template-subject"
              placeholder="e.g., Welcome to {{company}}!"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use merge tags like {"{{first_name}}"} for personalization
            </p>
          </div>

          {/* Email Body Editor */}
          <div className="space-y-2">
            <Label>Email Body</Label>
            <EmailTemplateEditor
              value={bodyHtml}
              onChange={setBodyHtml}
            />
          </div>
        </div>

        <SheetFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || !name}>
            {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Template"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
