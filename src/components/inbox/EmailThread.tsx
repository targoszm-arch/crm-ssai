import { useState } from "react";
import { format } from "date-fns";
import { Mail, User, Send, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Email, useSendEmail, useLinkEmailToContact } from "@/hooks/useEmails";
import { EmailAccount } from "@/hooks/useEmailAccounts";
import { useContacts, Contact } from "@/hooks/useContacts";
import { toast } from "@/hooks/use-toast";

interface EmailThreadProps {
  email: Email;
  account: EmailAccount | null;
  onClose: () => void;
}

export function EmailThread({ email, account, onClose }: EmailThreadProps) {
  const [replyBody, setReplyBody] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  const sendEmail = useSendEmail();
  const linkEmail = useLinkEmailToContact();
  const { data: contacts } = useContacts({});

  const handleSendReply = () => {
    if (!account || !replyBody.trim()) return;

    const replyTo = email.direction === "inbound" ? email.from_email : email.to_emails?.[0];
    if (!replyTo) return;

    sendEmail.mutate(
      {
        accountId: account.id,
        to: [replyTo],
        subject: email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
        body: replyBody,
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-start justify-between">
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

      {/* Link to Contact */}
      <div className="px-4 py-3 border-b bg-muted/50">
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

      {/* Email Body */}
      <div className="flex-1 overflow-auto p-4">
        <div className="prose prose-sm max-w-none">
          {email.body_html ? (
            <div dangerouslySetInnerHTML={{ __html: email.body_html }} />
          ) : (
            <p className="whitespace-pre-wrap">{email.snippet}</p>
          )}
        </div>
      </div>

      {/* Reply Section */}
      <Separator />
      <div className="p-4 bg-muted/30">
        {isReplying ? (
          <div className="space-y-3">
            <Textarea
              placeholder="Write your reply..."
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsReplying(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSendReply}
                disabled={!replyBody.trim() || sendEmail.isPending}
              >
                <Send className="h-4 w-4 mr-1" />
                Send Reply
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setIsReplying(true)} className="w-full">
            <Mail className="h-4 w-4 mr-2" />
            Reply
          </Button>
        )}
      </div>
    </div>
  );
}
