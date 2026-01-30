import { useState } from "react";
import { format } from "date-fns";
import { Linkedin, ExternalLink, X, User, Link2, Sparkles, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LinkedInMessage } from "@/hooks/useLinkedInMessages";
import { useContacts, Contact } from "@/hooks/useContacts";
import { useGenerateLinkedInDraft, DraftTone } from "@/hooks/useGenerateLinkedInDraft";
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
  const generateDraft = useGenerateLinkedInDraft();
  const [draftText, setDraftText] = useState("");
  const [showDraft, setShowDraft] = useState(false);
  const [copied, setCopied] = useState(false);

  // Get sender name from connection or message
  const senderName = message.connection?.name || (message as any).sender_name || "LinkedIn User";
  
  // Get profile URL from connection or message
  const profileUrl = message.connection?.profile_url || (message as any).profile_url;

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
    if (profileUrl) {
      window.open(profileUrl, "_blank");
    } else {
      // Fallback to search
      window.open(`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(senderName)}`, "_blank");
    }
  };

  const handleGenerateDraft = (tone: DraftTone) => {
    generateDraft.mutate(
      {
        messageText: message.message_text,
        senderName: senderName,
        tone,
      },
      {
        onSuccess: (draft) => {
          setDraftText(draft);
          setShowDraft(true);
          toast({
            title: "Draft Generated",
            description: `${tone.charAt(0).toUpperCase() + tone.slice(1)} reply draft created. Copy and paste into LinkedIn.`,
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

  const handleCopyDraft = async () => {
    await navigator.clipboard.writeText(draftText);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Draft copied to clipboard. Paste it in LinkedIn.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header - fixed */}
      <div className="flex-shrink-0 p-4 border-b flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
              <Linkedin className="h-5 w-5 text-[#0A66C2]" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{senderName}</h2>
              {message.connection?.headline && (
                <p className="text-sm text-muted-foreground">
                  {message.connection.headline}
                </p>
              )}
              {/* Show campaign name if available */}
              {(message as any).campaign_name && (
                <Badge variant="outline" className="mt-1 text-xs">
                  Campaign: {(message as any).campaign_name}
                </Badge>
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

      {/* Link to Contact - fixed */}
      <div className="flex-shrink-0 px-4 py-3 border-b bg-muted/50">
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

      {/* Reply action - fixed at top with AI draft */}
      <div className="flex-shrink-0 border-b bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Button className="flex-1" variant="outline" onClick={openInLinkedIn}>
            <Linkedin className="h-4 w-4 mr-2" />
            Reply in LinkedIn
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={generateDraft.isPending}>
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

        {/* Draft section */}
        {showDraft && draftText && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Suggested Reply Draft:</span>
              <Button variant="ghost" size="sm" onClick={handleCopyDraft}>
                {copied ? (
                  <Check className="h-4 w-4 mr-1 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <Textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={4}
              className="text-sm"
              placeholder="AI-generated draft will appear here..."
            />
            <p className="text-xs text-muted-foreground">
              Edit as needed, then copy and paste into LinkedIn.
            </p>
          </div>
        )}
      </div>

      {/* Message Body - scrollable */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div className="bg-muted/30 rounded-lg p-4">
          <p className="whitespace-pre-wrap">{message.message_text}</p>
        </div>
      </div>
    </div>
  );
}
