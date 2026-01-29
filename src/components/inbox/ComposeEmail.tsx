import { useState } from "react";
import { X, Send, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useSendEmail } from "@/hooks/useEmails";
import { EmailAccount } from "@/hooks/useEmailAccounts";
import { useContacts, Contact } from "@/hooks/useContacts";
import { toast } from "@/hooks/use-toast";

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

  const sendEmail = useSendEmail();
  const { data: contacts } = useContacts({});

  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    const contact = contacts?.find((c: Contact) => c.id === contactId);
    if (contact?.email) {
      setTo(contact.email);
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

    sendEmail.mutate(
      {
        accountId: account.id,
        to: to.split(",").map((e) => e.trim()),
        subject,
        body,
        contactId: selectedContactId || undefined,
      },
      {
        onSuccess: () => {
          toast({
            title: "Email Sent",
            description: "Your email has been sent successfully.",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Email</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

          <div>
            <Label htmlFor="body" className="text-xs text-muted-foreground">
              Message
            </Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              rows={10}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={!to.trim() || !subject.trim() || !body.trim() || sendEmail.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
