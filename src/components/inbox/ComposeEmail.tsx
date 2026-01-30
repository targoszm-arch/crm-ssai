import { useState } from "react";
import { X, Send, Sparkles, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSendEmail } from "@/hooks/useEmails";
import { EmailAccount } from "@/hooks/useEmailAccounts";
import { useContacts, Contact } from "@/hooks/useContacts";
import { useEmailSignature } from "@/hooks/useEmailSignature";
import { useGenerateEmailDraft, DraftTone } from "@/hooks/useGenerateEmailDraft";
import { RichTextComposer } from "@/components/shared/RichTextComposer";
import { toast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";

type EmailTemplate = Tables<"email_templates">;

interface ComposeEmailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: EmailAccount | null;
  defaultTo?: string;
  defaultContactId?: string;
}

export function ComposeEmail({
  open,
  onOpenChange,
  account,
  defaultTo = "",
  defaultContactId,
}: ComposeEmailProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedContactId, setSelectedContactId] = useState(defaultContactId || "");
  const [isTracked, setIsTracked] = useState(true); // Default to tracking enabled

  const sendEmail = useSendEmail();
  const { data: contacts } = useContacts({});
  const { data: signature } = useEmailSignature();
  const generateDraft = useGenerateEmailDraft();

  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    const contact = contacts?.find((c: Contact) => c.id === contactId);
    if (contact?.email) {
      setTo(contact.email);
    }
  };

  const handleGenerateDraft = (tone: DraftTone) => {
    if (!subject.trim()) {
      toast({
        title: "Subject Required",
        description: "Please enter a subject before generating a draft.",
        variant: "destructive",
      });
      return;
    }

    generateDraft.mutate(
      { to, subject, tone },
      {
        onSuccess: (draft) => {
          // Convert plain text to HTML for the rich editor
          setBody(draft.replace(/\n/g, '<br>'));
          toast({
            title: "Draft Generated",
            description: `${tone.charAt(0).toUpperCase() + tone.slice(1)} draft created. Feel free to edit before sending.`,
          });
        },
        onError: (error) => {
          toast({
            title: "Generation Failed",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleTemplateSelect = (template: EmailTemplate) => {
    const content = template.body_html || template.body_text || "";
    setBody(content);
    // Auto-fill subject if template has one and subject is empty
    if (template.subject && !subject.trim()) {
      setSubject(template.subject);
    }
  };

  const handleSend = () => {
    if (!account || !to.trim() || !subject.trim() || !body.trim()) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Body is already HTML from RichTextComposer, append signature if exists
    let finalBody = body;
    if (signature?.signature_html) {
      finalBody = `<div style="font-family: sans-serif;">${body}</div>
        <br><div style="margin-top: 16px; border-top: 1px solid #ddd; padding-top: 12px;">
        ${signature.signature_html}</div>`;
    }

    sendEmail.mutate(
      {
        accountId: account.id,
        to: to.split(",").map((e) => e.trim()),
        subject,
        body: finalBody,
        contactId: selectedContactId || undefined,
        isTracked,
      },
      {
        onSuccess: () => {
          toast({
            title: "Email Sent",
            description: isTracked 
              ? "Your email has been sent with tracking enabled."
              : "Your email has been sent successfully.",
          });
          setTo("");
          setSubject("");
          setBody("");
          setSelectedContactId("");
          onOpenChange(false);
        },
        onError: (error) => {
          toast({
            title: "Send Failed",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  // Strip HTML to check if body has content
  const getPlainTextLength = (html: string) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return (tempDiv.textContent || tempDiv.innerText || "").trim().length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>New Email</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label htmlFor="to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
              />
            </div>
            <div className="w-[200px]">
              <Label className="text-xs text-muted-foreground">Select Contact</Label>
              <Select value={selectedContactId} onValueChange={handleSelectContact}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts?.map((contact: Contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                      {contact.email && (
                        <span className="text-muted-foreground ml-1">({contact.email})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="subject" className="text-xs text-muted-foreground">
              Subject
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="body" className="text-xs text-muted-foreground">
                Message
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    disabled={generateDraft.isPending}
                  >
                    {generateDraft.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1" />
                    )}
                    {generateDraft.isPending ? "Generating..." : "AI Draft"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleGenerateDraft("professional")}>
                    Professional tone
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleGenerateDraft("casual")}>
                    Casual tone
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleGenerateDraft("brief")}>
                    Brief & concise
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <RichTextComposer
              value={body}
              onChange={setBody}
              placeholder="Write your message..."
              minHeight={200}
              maxHeight={350}
              showTemplates
              showMergeTags
              onTemplateSelect={handleTemplateSelect}
            />
          </div>

          {/* Signature preview */}
          {signature?.signature_text && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              <span className="font-medium">Signature will be added:</span>
              <div className="mt-1 whitespace-pre-wrap opacity-60">{signature.signature_text}</div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            {/* Tracking Toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="tracking"
                      checked={isTracked}
                      onCheckedChange={setIsTracked}
                    />
                    <Label 
                      htmlFor="tracking" 
                      className="text-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <Eye className="h-4 w-4" />
                      Track opens & clicks
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>When enabled, you'll be notified when recipients open the email or click links</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={!to.trim() || !subject.trim() || getPlainTextLength(body) === 0 || sendEmail.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
