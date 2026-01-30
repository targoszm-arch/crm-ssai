import { formatDistanceToNow } from "date-fns";
import { Linkedin, User, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLinkedInMessages, LinkedInMessage } from "@/hooks/useLinkedInMessages";
import { cn } from "@/lib/utils";

interface LinkedInMessageListProps {
  search: string;
  linkedOnly: boolean;
  selectedMessage: LinkedInMessage | null;
  onSelectMessage: (message: LinkedInMessage) => void;
}

export function LinkedInMessageList({
  search,
  linkedOnly,
  selectedMessage,
  onSelectMessage,
}: LinkedInMessageListProps) {
  const { data: messages, isLoading } = useLinkedInMessages({
    search: search || undefined,
    linkedOnly,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <Linkedin className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">No LinkedIn messages found</p>
        <p className="text-xs mt-2 text-center">
          Messages will appear here when synced from your browser extension
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {messages.map((message) => (
        <button
          key={message.id}
          onClick={() => onSelectMessage(message)}
          className={cn(
            "w-full text-left p-4 hover:bg-accent transition-colors",
            selectedMessage?.id === message.id && "bg-accent",
            !message.is_read && "bg-primary/5 border-l-2 border-l-[#0A66C2]"
          )}
        >
          <div className="flex items-start gap-3">
            {/* Unread Indicator */}
            {!message.is_read && (
              <div className="w-2 h-2 rounded-full bg-[#0A66C2] mt-2 flex-shrink-0" />
            )}
            
            <div className="w-8 h-8 rounded-full bg-[#0A66C2]/10 flex items-center justify-center flex-shrink-0">
              {message.connection?.contact_id ? (
                <User className="h-4 w-4 text-[#0A66C2]" />
              ) : (
                <Linkedin className="h-4 w-4 text-[#0A66C2]" />
              )}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-sm truncate", !message.is_read && "font-semibold")}>
                  {message.sender_name || message.connection?.name || message.sender_linkedin_id}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDistanceToNow(new Date(message.message_timestamp), { addSuffix: true })}
                </span>
              </div>
              {message.connection?.headline && (
                <p className="text-xs text-muted-foreground truncate">
                  {message.connection.headline}
                </p>
              )}
              <p className={cn("text-sm truncate mt-0.5", !message.is_read && "font-medium")}>
                {message.message_text}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs py-0 bg-[#0A66C2]/5 border-[#0A66C2]/20 text-[#0A66C2]">
                  <Linkedin className="h-3 w-3 mr-1" />
                  LinkedIn
                </Badge>
                {message.campaign_name && (
                  <Badge variant="outline" className="text-xs py-0">
                    {message.campaign_name}
                  </Badge>
                )}
                {message.company_name && (
                  <Badge variant="secondary" className="text-xs py-0">
                    {message.company_name}
                  </Badge>
                )}
                {message.connection?.contacts && (
                  <Badge variant="secondary" className="text-xs py-0">
                    <Link2 className="h-3 w-3 mr-1" />
                    {message.connection.contacts.first_name} {message.connection.contacts.last_name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
