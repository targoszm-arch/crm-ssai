import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Mail, User, RefreshCw, Search, Link2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Email, useEmails, useSyncEmails } from "@/hooks/useEmails";
import { EmailAccount } from "@/hooks/useEmailAccounts";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface EmailListProps {
  accounts: EmailAccount[];
  selectedEmail: Email | null;
  onSelectEmail: (email: Email) => void;
}

export function EmailList({ accounts, selectedEmail, onSelectEmail }: EmailListProps) {
  const [filter, setFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [search, setSearch] = useState("");
  
  const accountId = accounts[0]?.id;
  
  const { data: emails, isLoading } = useEmails({
    accountId,
    linkedOnly: filter === "linked",
    search: search || undefined,
  });

  const syncEmails = useSyncEmails();

  const handleSync = () => {
    if (!accountId) return;

    syncEmails.mutate(
      { accountId, maxResults: 2000, daysBack: 100 },
      {
        onSuccess: (data) => {
          toast({
            title: "Emails Synced",
            description: `Synced ${data.syncedCount} new emails (${data.skippedCount || 0} already synced)`,
          });
        },
        onError: (error) => {
          toast({
            title: "Sync Failed",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const filteredEmails = emails?.filter((email) => {
    if (filter === "unlinked") {
      return !email.contact_id;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Inbox</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={syncEmails.isPending || !accountId}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", syncEmails.isPending && "animate-spin")} />
            Sync
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="linked" className="flex-1">
              <Link2 className="h-3 w-3 mr-1" />
              Linked
            </TabsTrigger>
            <TabsTrigger value="unlinked" className="flex-1">
              <Link2Off className="h-3 w-3 mr-1" />
              Unlinked
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : filteredEmails && filteredEmails.length > 0 ? (
          <div className="divide-y">
            {filteredEmails.map((email) => (
              <button
                key={email.id}
                onClick={() => onSelectEmail(email)}
                className={cn(
                  "w-full text-left p-4 hover:bg-accent transition-colors",
                  selectedEmail?.id === email.id && "bg-accent",
                  !email.is_read && "bg-primary/5"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {email.contacts ? (
                      <User className="h-4 w-4 text-primary" />
                    ) : (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-sm truncate", !email.is_read && "font-semibold")}>
                        {email.direction === "inbound"
                          ? email.from_name || email.from_email
                          : `To: ${email.to_emails?.[0] || "Unknown"}`}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className={cn("text-sm truncate", !email.is_read && "font-medium")}>
                      {email.subject || "(No subject)"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {email.snippet}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {email.contacts && (
                        <Badge variant="secondary" className="text-xs py-0">
                          <Link2 className="h-3 w-3 mr-1" />
                          {email.contacts.first_name} {email.contacts.last_name}
                        </Badge>
                      )}
                      {email.direction === "outbound" && (
                        <Badge variant="outline" className="text-xs py-0">Sent</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
            <Mail className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">No emails found</p>
            {accountId && (
              <Button variant="outline" size="sm" className="mt-4" onClick={handleSync}>
                Sync Emails
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
