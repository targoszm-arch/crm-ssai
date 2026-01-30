import { format } from "date-fns";
import { Linkedin, ExternalLink, X, User, Link2 } from "lucide-react";
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
import { LinkedInMessage } from "@/hooks/useLinkedInMessages";
import { useContacts, Contact } from "@/hooks/useContacts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface LinkedInMessageViewProps {
  message: LinkedInMessage;
  onClose: () => void;
}

export function LinkedInMessageView({ message, onClose }: LinkedInMessageViewProps) {
  const { data: contacts } = useContacts({});
  const queryClient = useQueryClient();

  const handleLinkContact = async (contactId: string) => {
    if (!message.connection_id) {
      toast({
        title: "Cannot Link",
        description: "This message doesn't have an associated connection.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("linkedin_connections")
      .update({ contact_id: contactId || null })
      .eq("id", message.connection_id);

    if (error) {
      toast({
        title: "Link Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Contact Linked",
        description: "LinkedIn connection has been linked to the contact.",
      });
      queryClient.invalidateQueries({ queryKey: ["linkedin-messages"] });
    }
  };

  const openInLinkedIn = () => {
    if (message.connection?.profile_url) {
      window.open(message.connection.profile_url, "_blank");
    } else {
      window.open(`https://www.linkedin.com/in/${message.sender_linkedin_id}`, "_blank");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
              <Linkedin className="h-5 w-5 text-[#0A66C2]" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">
                {message.connection?.name || "LinkedIn User"}
              </h2>
              {message.connection?.headline && (
                <p className="text-sm text-muted-foreground">
                  {message.connection.headline}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {format(new Date(message.message_timestamp), "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openInLinkedIn}>
            <ExternalLink className="h-4 w-4 mr-1" />
            Open in LinkedIn
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Link to Contact */}
      <div className="px-4 py-3 border-b bg-muted/50">
        <div className="flex items-center gap-3">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Link to contact:</span>
          <Select
            value={message.connection?.contact_id || "unlinked"}
            onValueChange={(value) => handleLinkContact(value === "unlinked" ? "" : value)}
            disabled={!message.connection_id}
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
          {message.connection?.contacts && (
            <Badge variant="secondary">
              <User className="h-3 w-3 mr-1" />
              {message.connection.contacts.first_name} {message.connection.contacts.last_name}
            </Badge>
          )}
        </div>
      </div>

      {/* Message Body */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-muted/30 rounded-lg p-4">
          <p className="whitespace-pre-wrap">{message.message_text}</p>
        </div>
      </div>

      {/* Footer */}
      <Separator />
      <div className="p-4 bg-muted/30">
        <div className="text-center text-sm text-muted-foreground">
          <p>To reply, open this conversation in LinkedIn</p>
          <Button variant="outline" className="mt-2" onClick={openInLinkedIn}>
            <Linkedin className="h-4 w-4 mr-2" />
            Reply in LinkedIn
          </Button>
        </div>
      </div>
    </div>
  );
}
