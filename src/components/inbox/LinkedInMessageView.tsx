import { useState } from "react";
import { format } from "date-fns";
import { Linkedin, ExternalLink, X, User, Link2, Sparkles, Loader2, Copy, Check, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { LinkedInMessage } from "@/hooks/useLinkedInMessages";
import { useContacts, Contact, useCreateContact } from "@/hooks/useContacts";
import { useGenerateLinkedInDraft, DraftTone } from "@/hooks/useGenerateLinkedInDraft";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { RichTextComposer } from "@/components/shared/RichTextComposer";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

type EmailTemplate = Tables<"email_templates">;

interface LinkedInMessageViewProps {
  message: LinkedInMessage;
  onClose: () => void;
}

export function LinkedInMessageView({ message, onClose }: LinkedInMessageViewProps) {
  const { data: contacts } = useContacts({});
  const queryClient = useQueryClient();
  const generateDraft = useGenerateLinkedInDraft();
  const createContact = useCreateContact();
  const { user } = useAuth();
  const [draftText, setDraftText] = useState("");
  const [showDraft, setShowDraft] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAddingToCRM, setIsAddingToCRM] = useState(false);

  // Get sender name from message or connection
  const senderName = message.sender_name || message.connection?.name || "LinkedIn User";
  
  // Get profile URL from message or connection
  const profileUrl = message.profile_url || message.connection?.profile_url;
  
  // Get conversation URL (direct link to message thread) - preferred for replies
  const conversationUrl = message.linkedin_conversation_url;
  
  // Get company name if available
  const companyName = message.company_name;

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
    // Prefer conversation URL (direct link to message thread)
    if (conversationUrl) {
      window.open(conversationUrl, "_blank");
    } else if (profileUrl) {
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
          // Convert plain text to HTML for the rich editor
          setDraftText(draft.replace(/\n/g, '<br>'));
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
    // Strip HTML for copying
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = draftText;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";
    
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Draft copied to clipboard. Paste it in LinkedIn.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTemplateSelect = (template: EmailTemplate) => {
    const content = template.body_html || template.body_text || "";
    setDraftText(content);
    setShowDraft(true);
  };

  const handleAddToCRM = async () => {
    if (!user) {
      toast({
        title: "Not Authenticated",
        description: "Please log in to add contacts.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingToCRM(true);
    try {
      // Parse name into first/last
      const nameParts = senderName.trim().split(" ");
      const firstName = nameParts[0] || "Unknown";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Get additional data from connection if available
      const headline = message.connection?.headline || "";
      const linkedinUrl = profileUrl || "";
      const company = companyName || "";

      // Create the contact
      const newContact = await createContact.mutateAsync({
        first_name: firstName,
        last_name: lastName,
        title: headline,
        linkedin_url: linkedinUrl,
        user_id: user.id,
        notes: company ? `Company: ${company}` : undefined,
      });

      // Link the LinkedIn connection to this new contact
      if (message.connection_id) {
        await supabase
          .from("linkedin_connections")
          .update({ contact_id: newContact.id })
          .eq("id", message.connection_id);
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["linkedin-messages"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });

      toast({
        title: "Contact Created",
        description: `${firstName} ${lastName} has been added to your CRM.`,
      });
    } catch (error) {
      toast({
        title: "Failed to Add Contact",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsAddingToCRM(false);
    }
  };

  // Check if contact is already linked
  const isContactLinked = !!message.connection?.contact_id;

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
              {companyName && (
                <p className="text-sm text-muted-foreground">
                  {companyName}
                </p>
              )}
              {/* Show campaign name if available */}
              {message.campaign_name && (
                <Badge variant="outline" className="mt-1 text-xs">
                  Campaign: {message.campaign_name}
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
        <div className="flex items-center gap-3 flex-wrap">
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
          {/* Add to CRM button - show when no contact is linked */}
          {!isContactLinked && message.connection_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddToCRM}
              disabled={isAddingToCRM}
            >
              {isAddingToCRM ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-1" />
              )}
              Add to CRM
            </Button>
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

        {/* Draft section with RichTextComposer */}
        {showDraft && (
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
            <RichTextComposer
              value={draftText}
              onChange={setDraftText}
              placeholder="AI-generated draft will appear here..."
              minHeight={80}
              maxHeight={150}
              compact
              showTemplates
              showMergeTags={false}
              onTemplateSelect={handleTemplateSelect}
            />
            <p className="text-xs text-muted-foreground">
              Edit as needed, then copy and paste into LinkedIn.
            </p>
          </div>
        )}

        {/* Show template button when draft is not visible */}
        {!showDraft && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setShowDraft(true)}
          >
            Or use a template to compose a draft...
          </Button>
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
