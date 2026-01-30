import { useState, useRef } from "react";
import { format } from "date-fns";
import { Mail, User, Send, Link2, X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { Email, useSendEmail, useLinkEmailToContact } from "@/hooks/useEmails";
import { EmailAccount } from "@/hooks/useEmailAccounts";
import { useContacts, Contact } from "@/hooks/useContacts";
import { useGenerateEmailReply, ReplyTone } from "@/hooks/useEmailReply";
import { toast } from "@/hooks/use-toast";

interface EmailThreadProps {
  email: Email;
  account: EmailAccount | null;
  onClose: () => void;
}

export function EmailThread({ email, account, onClose }: EmailThreadProps) {
  const [replyBody, setReplyBody] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const replyEditorRef = useRef<HTMLDivElement>(null);

  const sendEmail = useSendEmail();
  const linkEmail = useLinkEmailToContact();
  const generateReply = useGenerateEmailReply();
  const { data: contacts } = useContacts({});

  // Get reply recipient
  const replyTo = email.direction === "inbound" ? email.from_email : email.to_emails?.[0];
  const replyToName = email.direction === "inbound" 
    ? (email.from_name || email.from_email)
    : email.to_emails?.[0];

  const handleSendReply = () => {
    if (!account || !replyBody.trim()) return;
    if (!replyTo) return;

    // Format reply with quoted original message
    const formattedBody = formatReplyHtml(replyBody, email);

    sendEmail.mutate(
      {
        accountId: account.id,
        to: [replyTo],
        subject: email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
        body: formattedBody,
        contactId: email.contact_id || undefined,
      },
      {
        onSuccess: () => {
          toast({
            title: "Reply Sent",
            description: "Your reply has been sent successfully.",
          });
          setReplyBody("");
          setIsReplying(false);
          if (replyEditorRef.current) {
            replyEditorRef.current.innerHTML = "";
          }
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

  const handleGenerateReply = (tone: ReplyTone) => {
    generateReply.mutate(
      { emailId: email.id, tone },
      {
        onSuccess: (reply) => {
          setReplyBody(reply);
          if (replyEditorRef.current) {
            replyEditorRef.current.innerText = reply;
          }
          toast({
            title: "Reply Suggested",
            description: `${tone.charAt(0).toUpperCase() + tone.slice(1)} reply generated. Feel free to edit before sending.`,
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

  const handleLinkContact = (contactId: string) => {
    linkEmail.mutate(
      { emailId: email.id, contactId: contactId || null },
      {
        onSuccess: () => {
          toast({
            title: "Contact Linked",
            description: "Email has been linked to the contact.",
          });
        },
        onError: (error) => {
          toast({
            title: "Link Failed",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleEditorInput = () => {
    if (replyEditorRef.current) {
      setReplyBody(replyEditorRef.current.innerText);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header - fixed at top */}
      <div className="flex-shrink-0 p-4 border-b flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-lg truncate">{email.subject || "(No subject)"}</h2>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{email.direction === "inbound" ? "From:" : "To:"}</span>
            <span className="font-medium text-foreground">
              {email.direction === "inbound"
                ? email.from_name || email.from_email
                : email.to_emails?.join(", ")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(email.received_at), "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Link to Contact - fixed */}
      <div className="flex-shrink-0 px-4 py-3 border-b bg-muted/50">
        <div className="flex items-center gap-3">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Link to contact:</span>
          <Select
            value={email.contact_id || "unlinked"}
            onValueChange={(value) => handleLinkContact(value === "unlinked" ? "" : value)}
          >
            <SelectTrigger className="w-[200px] h-8">
              <SelectValue placeholder="Select contact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unlinked">No contact</SelectItem>
              {contacts?.map((contact: Contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.first_name} {contact.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {email.contacts && (
            <Badge variant="secondary">
              <User className="h-3 w-3 mr-1" />
              {email.contacts.first_name} {email.contacts.last_name}
            </Badge>
          )}
        </div>
      </div>

      {/* Email Body - scrollable middle section */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {email.body_html ? (
            <div 
              dangerouslySetInnerHTML={{ __html: email.body_html }} 
              className="email-content"
            />
          ) : (
            <p className="whitespace-pre-wrap">{email.snippet}</p>
          )}
        </div>
      </div>

      {/* Reply Section - FIXED at bottom, always visible */}
      <div className="flex-shrink-0 border-t bg-muted/30 p-4">
        {isReplying ? (
          <div className="space-y-3">
            {/* Reply header */}
            <div className="text-sm text-muted-foreground">
              Replying to <span className="font-medium text-foreground">{replyToName}</span>
            </div>

            {/* Rich text editor area */}
            <div
              ref={replyEditorRef}
              contentEditable
              onInput={handleEditorInput}
              className="min-h-[100px] max-h-[200px] overflow-auto p-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              data-placeholder="Write your reply..."
              style={{ whiteSpace: 'pre-wrap' }}
            />

            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={generateReply.isPending}
                  >
                    {generateReply.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1" />
                    )}
                    {generateReply.isPending ? "Generating..." : "AI Suggest"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => handleGenerateReply("professional")}>
                    Professional tone
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleGenerateReply("casual")}>
                    Casual tone
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleGenerateReply("brief")}>
                    Brief & concise
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsReplying(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSendReply}
                  disabled={!replyBody.trim() || sendEmail.isPending}
                >
                  <Send className="h-4 w-4 mr-1" />
                  {sendEmail.isPending ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button onClick={() => setIsReplying(true)} className="w-full">
            <Mail className="h-4 w-4 mr-2" />
            Reply
          </Button>
        )}
      </div>
    </div>
  );
}

// Format reply with quoted original message
function formatReplyHtml(replyText: string, originalEmail: Email): string {
  const replyHtml = replyText.replace(/\n/g, '<br>');
  
  const quotedDate = format(new Date(originalEmail.received_at), "EEE, MMM d, yyyy 'at' h:mm a");
  const quotedFrom = originalEmail.from_name 
    ? `${originalEmail.from_name} &lt;${originalEmail.from_email}&gt;` 
    : originalEmail.from_email;
  
  return `
    <div style="font-family: sans-serif;">
      ${replyHtml}
    </div>
    <br>
    <div style="color: #666; border-left: 2px solid #ccc; padding-left: 12px; margin-top: 16px;">
      <p style="margin: 0 0 8px 0; font-size: 12px;">
        On ${quotedDate}, ${quotedFrom} wrote:
      </p>
      <blockquote style="margin: 0; padding: 0;">
        ${originalEmail.body_html || `<p>${originalEmail.snippet || ''}</p>`}
      </blockquote>
    </div>
  `.trim();
}
