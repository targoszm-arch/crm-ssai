import { useState, useRef, useEffect } from "react";
import { sanitizeHtml } from "@/lib/sanitize";
import { format } from "date-fns";
import { Mail, User, Send, Link2, X, Sparkles, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { Badge } from "@/components/ui/badge";
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
import { Email, useSendEmail, useLinkEmailToContact, useMarkEmailRead, useUpdateEmailLabels } from "@/hooks/useEmails";
import { EmailAccount } from "@/hooks/useEmailAccounts";
import { useContacts, Contact } from "@/hooks/useContacts";
import { useGenerateEmailReply, ReplyTone } from "@/hooks/useEmailReply";
import { useEmailSignature } from "@/hooks/useEmailSignature";
import { RichTextComposer } from "@/components/shared/RichTextComposer";
import { AddContactModal } from "@/components/customers/AddContactModal";
import { EditableLabels } from "@/components/customers/EditableLabels";
import { toast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";

type EmailTemplate = Tables<"email_templates">;

interface EmailThreadProps {
  email: Email;
  account: EmailAccount | null;
  onClose: () => void;
}

export function EmailThread({ email, account, onClose }: EmailThreadProps) {
  const [replyBody, setReplyBody] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const markedEmailIdRef = useRef<string | null>(null);

  const sendEmail = useSendEmail();
  const linkEmail = useLinkEmailToContact();
  const markEmailRead = useMarkEmailRead();
  const updateLabels = useUpdateEmailLabels();
  const generateReply = useGenerateEmailReply();
  const { data: contacts, refetch: refetchContacts } = useContacts({});
  const { data: signature } = useEmailSignature();

  // Parse sender info for contact creation
  const senderEmail = email.from_email;
  const senderName = email.from_name || senderEmail.split("@")[0];
  const nameParts = senderName.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Prefill data for AddContactModal
  const contactPrefillData = {
    first_name: firstName,
    last_name: lastName,
    email: senderEmail,
  };

  const handleContactCreated = async (newContactId: string) => {
    // Link the email to the newly created contact
    linkEmail.mutate(
      { emailId: email.id, contactId: newContactId },
      {
        onSuccess: () => {
          toast({
            title: "Contact Created & Linked",
            description: `${firstName} ${lastName} has been added to CRM and linked to this email.`,
          });
          refetchContacts();
        },
      }
    );
  };

  // Opening a message is the read action. Keep the id in the guard (rather
  // than a boolean reset in a second effect) so moving directly from one
  // unread message to another cannot accidentally skip the second message.
  useEffect(() => {
    if (email.is_read || markedEmailIdRef.current === email.id) return;

    markedEmailIdRef.current = email.id;
    markEmailRead.mutate(
      { emailId: email.id, isRead: true },
      {
        onError: (error) => {
          markedEmailIdRef.current = null;
          console.error("Failed to mark email thread as read:", error);
        },
      }
    );
  }, [email.id, email.is_read, markEmailRead]);

  // Get reply recipient
  const replyTo = email.direction === "inbound" ? email.from_email : email.to_emails?.[0];
  const replyToName = email.direction === "inbound" 
    ? (email.from_name || email.from_email)
    : email.to_emails?.[0];

  const handleSendReply = () => {
    // These were three silent returns. The Send button is only disabled on an
    // empty body, so with no connected mailbox — or an email with no address
    // to reply to — the button looked live and clicking it did nothing at all,
    // no toast, no error, nothing in the log. Say why instead.
    if (!account) {
      toast({
        title: "No mailbox connected",
        description: "Connect a Google account in Settings before sending.",
        variant: "destructive",
      });
      return;
    }
    if (!replyTo) {
      toast({
        title: "Nowhere to reply to",
        description: "This message carries no sender or recipient address.",
        variant: "destructive",
      });
      return;
    }
    if (!replyBody.trim()) return;

    // Format reply with quoted original message and signature
    const formattedBody = formatReplyHtml(replyBody, email, signature?.signature_html);

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
          // Set as HTML with line breaks
          setReplyBody(reply.replace(/\n/g, '<br>'));
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

  const handleSaveLabels = async (labels: string) => {
    await updateLabels.mutateAsync(
      { emailId: email.id, labels },
      {
        onError: (error) => {
          toast({
            title: "Couldn't save labels",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleTemplateSelect = (template: EmailTemplate) => {
    const content = template.body_html || template.body_text || "";
    setReplyBody(content);
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
        <div className="flex items-center gap-3 flex-wrap">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Link to contact:</span>
          <SearchableSelect
              className="w-[200px] h-8"
              options={[
                { value: "unlinked", label: "No contact", alwaysShow: true },
                { value: "create-new", label: "Create new contact", alwaysShow: true },
                ...(contacts ?? []).map((contact: Contact) => ({
                  value: contact.id,
                  label: [contact.first_name, contact.last_name].filter(Boolean).join(" ")
                    || contact.name || "(no name)",
                  hint: contact.email ?? undefined,
                })),
              ]}
              value={email.contact_id || "unlinked"}
              onChange={(value) => {
                if (!value) return;
                if (value === "create-new") {
                  setAddContactOpen(true);
                } else {
                  handleLinkContact(value === "unlinked" ? "" : value);
                }
              }}
              placeholder="Select contact"
              searchPlaceholder="Search by name or email..."
              emptyText="No contact found."
              
            />
          {email.contacts && (
            <Badge variant="secondary">
              <User className="h-3 w-3 mr-1" />
              {email.contacts.first_name} {email.contacts.last_name}
            </Badge>
          )}
        </div>
      </div>

      {/* Labels */}
      <div className="flex-shrink-0 px-4 py-3 border-b">
        <EditableLabels
          labels={email.email_labels}
          onSave={handleSaveLabels}
          isLoading={updateLabels.isPending}
        />
      </div>

      {/* Add Contact Modal */}
      <AddContactModal
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
        prefillData={contactPrefillData}
        onSuccess={handleContactCreated}
      />

      {/* Reply composer and the message it replies to share ONE scroller.
          They used to be two: the composer was flex-shrink-0 above a
          `flex-1 overflow-auto` body, and the editor inside the composer has
          an overflow-auto of its own — three nested scrollports inside a
          fill-height page, so which one moved depended on where the pointer
          happened to be. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="shrink-0 border-b bg-muted/30 p-4">
        {isReplying ? (
          <div className="space-y-3">
            {/* Reply header */}
            <div className="text-sm text-muted-foreground">
              Replying to <span className="font-medium text-foreground">{replyToName}</span>
            </div>

            {/* Rich text editor with templates */}
            <RichTextComposer
              value={replyBody}
              onChange={setReplyBody}
              placeholder="Write your reply..."
              minHeight={100}
              maxHeight={200}
              compact
              showTemplates
              showMergeTags
              onTemplateSelect={handleTemplateSelect}
            />

            {/* Signature preview */}
            {signature?.signature_text && (
              <div className="text-xs text-muted-foreground border-t pt-2">
                <span className="font-medium">Signature will be added:</span>
                <div className="mt-1 whitespace-pre-wrap opacity-60">{signature.signature_text}</div>
              </div>
            )}

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
                  title={
                    !account
                      ? "No mailbox connected — connect one in Settings"
                      : !replyTo
                        ? "This message has no address to reply to"
                        : undefined
                  }
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

      {/* Email Body — scrolls with the composer above it, not against it. */}
      <div className="p-4">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {email.body_html ? (
            <div 
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.body_html) }} 
              className="email-content"
            />
          ) : (
            <p className="whitespace-pre-wrap">{email.snippet}</p>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

// Format reply with quoted original message and signature
function formatReplyHtml(replyText: string, originalEmail: Email, signatureHtml?: string): string {
  // replyText is already HTML from RichTextComposer
  const replyHtml = replyText;
  
  const quotedDate = format(new Date(originalEmail.received_at), "EEE, MMM d, yyyy 'at' h:mm a");
  const quotedFrom = originalEmail.from_name 
    ? `${originalEmail.from_name} &lt;${originalEmail.from_email}&gt;` 
    : originalEmail.from_email;
  
  const signatureSection = signatureHtml 
    ? `<br><div style="margin-top: 16px; border-top: 1px solid #ddd; padding-top: 12px;">${signatureHtml}</div>`
    : '';
  
  return `
    <div style="font-family: sans-serif;">
      ${replyHtml}
    </div>
    ${signatureSection}
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
