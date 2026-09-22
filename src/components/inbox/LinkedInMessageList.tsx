import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Linkedin, User, Link2, Search, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkedInMessage } from "@/hooks/useLinkedInMessages";
import { useLinkedInFeed, LinkedInFeedItem } from "@/hooks/useLinkedInFeed";
import { cn } from "@/lib/utils";

interface LinkedInMessageListProps {
  linkedOnly: boolean;
  selectedMessage: LinkedInMessage | null;
  onSelectMessage: (message: LinkedInMessage) => void;
}

export function LinkedInMessageList({
  linkedOnly,
  selectedMessage,
  onSelectMessage,
}: LinkedInMessageListProps) {
  // The search box lives here for the same reason the email one lives in EmailList:
  // the tab owns its own search. Previously this component was handed a hardcoded
  // search="" and there was no box at all, so the LinkedIn tab could not be searched.
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");

  const { data: items, isLoading } = useLinkedInFeed({
    search: search || undefined,
    linkedOnly,
  });

  // Same fix as EmailList: the open panel renders from the message object it was
  // selected with, a snapshot. Re-sync it to the fresh copy whenever the feed
  // refetches, so linking a contact updates the open panel without a reload.
  useEffect(() => {
    if (!selectedMessage || !items) return;
    const fresh = items.find(
      (item): item is Extract<LinkedInFeedItem, { kind: "message" }> =>
        item.kind === "message" && item.message.id === selectedMessage.id
    );
    if (fresh && fresh.message !== selectedMessage) {
      onSelectMessage(fresh.message);
    }
  }, [items, selectedMessage, onSelectMessage]);

  const searchBox = (
    <div className="p-3 border-b">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Press Enter to search LinkedIn..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSearch(draft)}
          className="pl-9"
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {searchBox}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
            <Linkedin className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">
              {search ? `No LinkedIn activity matching "${search}"` : "No LinkedIn messages found"}
            </p>
            <p className="text-xs mt-2 text-center">
              {search
                ? "Meet Alfred replies are stored as a ~200 character preview, so text beyond that is not in the CRM to find."
                : "Messages appear here when synced from your browser extension or from Meet Alfred."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item) =>
              item.kind === "message" ? (
                <MessageRow
                  key={item.id}
                  message={item.message}
                  isSelected={selectedMessage?.id === item.message.id}
                  onSelect={() => onSelectMessage(item.message)}
                />
              ) : (
                <ActivityRow key={item.id} item={item} />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageRow({
  message,
  isSelected,
  onSelect,
}: {
  message: LinkedInMessage;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-4 hover:bg-accent transition-colors",
        isSelected && "bg-accent",
        !message.is_read && "bg-primary/5 border-l-2 border-l-[#0A66C2]"
      )}
    >
      <div className="flex items-start gap-3">
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
  );
}

// A Meet Alfred row has no full thread to open — the CRM only holds the preview — so it
// takes you to the person instead, where the rest of their history is.
function ActivityRow({ item }: { item: Extract<LinkedInFeedItem, { kind: "activity" }> }) {
  const body = (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm truncate">{item.contactName ?? "Unknown contact"}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{item.text}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="outline" className="text-xs py-0">
            Meet Alfred
          </Badge>
          {item.campaign && (
            <Badge variant="secondary" className="text-xs py-0">
              {item.campaign}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );

  if (!item.contactId) {
    return <div className="w-full text-left p-4">{body}</div>;
  }

  return (
    <Link to={`/people/${item.contactId}`} className="block p-4 hover:bg-accent transition-colors">
      {body}
    </Link>
  );
}
