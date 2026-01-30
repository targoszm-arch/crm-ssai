import { useState } from "react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { Mail, User, RefreshCw, Search, Link2, Link2Off, MailOpen, MoreVertical, Eye, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Email, useEmails, useSyncEmails, useMarkEmailRead, EmailFilters } from "@/hooks/useEmails";
import { EmailAccount } from "@/hooks/useEmailAccounts";
import { LabelBadge } from "@/components/shared/LabelBadge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
interface EmailListProps {
  accounts: EmailAccount[];
  selectedEmail: Email | null;
  onSelectEmail: (email: Email) => void;
  folder?: string;
  filters?: EmailFilters;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  showCheckboxes?: boolean;
}
export function EmailList({
  accounts,
  selectedEmail,
  onSelectEmail,
  folder = "inbox",
  filters,
  selectedIds = [],
  onSelectionChange,
  showCheckboxes = false
}: EmailListProps) {
  const [filter, setFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [search, setSearch] = useState("");
  const accountId = accounts[0]?.id;
  const {
    data: emails,
    isLoading
  } = useEmails({
    accountId,
    linkedOnly: filter === "linked",
    search: search || undefined,
    folder: folder,
    ...filters
  });
  const syncEmails = useSyncEmails();
  const markEmailRead = useMarkEmailRead();
  const handleToggleRead = (e: React.MouseEvent, email: Email) => {
    e.stopPropagation();
    markEmailRead.mutate({
      emailId: email.id,
      isRead: !email.is_read
    }, {
      onSuccess: () => {
        toast({
          title: email.is_read ? "Marked as Unread" : "Marked as Read",
          description: "Email status updated"
        });
      },
      onError: error => {
        toast({
          title: "Update Failed",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };
  const handleSync = () => {
    if (!accountId) return;
    syncEmails.mutate({
      accountId,
      maxResults: 2000,
      daysBack: 100
    }, {
      onSuccess: data => {
        toast({
          title: "Emails Synced",
          description: `Synced ${data.syncedCount} new emails (${data.skippedCount || 0} already synced)`
        });
      },
      onError: error => {
        toast({
          title: "Sync Failed",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };
  const handleCheckboxChange = (emailId: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedIds, emailId]);
    } else {
      onSelectionChange(selectedIds.filter(id => id !== emailId));
    }
  };
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange || !filteredEmails) return;
    if (checked) {
      onSelectionChange(filteredEmails.map(e => e.id));
    } else {
      onSelectionChange([]);
    }
  };

  // Apply filters
  let filteredEmails = emails?.filter(email => {
    if (filter === "unlinked") {
      return !email.contact_id;
    }
    return true;
  });

  // Apply advanced filters
  if (filters && filteredEmails) {
    if (filters.isUnread) {
      filteredEmails = filteredEmails.filter(e => !e.is_read);
    }
    if (filters.isTracked) {
      filteredEmails = filteredEmails.filter(e => e.is_tracked);
    }
    if (filters.linkedWithDeal === true) {
      filteredEmails = filteredEmails.filter(e => e.deal_id);
    }
    if (filters.linkedWithDeal === false) {
      filteredEmails = filteredEmails.filter(e => !e.deal_id);
    }
    if (filters.hasAttachments) {
      filteredEmails = filteredEmails.filter(e => e.has_attachments);
    }
    if (filters.followUpDays) {
      const [minDays, maxDays] = filters.followUpDays.split("-").map(Number);
      filteredEmails = filteredEmails.filter(email => {
        if (email.direction !== "inbound") return false;
        const daysSince = differenceInDays(new Date(), new Date(email.received_at));
        return daysSince >= minDays && daysSince <= maxDays;
      });
    }
    if (filters.labels && filters.labels.length > 0) {
      filteredEmails = filteredEmails.filter(email => {
        if (!email.email_labels) return false;
        const emailLabels = email.email_labels.split(",").map(l => l.split(":")[0].trim());
        return filters.labels!.some(fl => emailLabels.includes(fl));
      });
    }
    if (filters.fromContact) {
      filteredEmails = filteredEmails.filter(e => e.contact_id);
    }
  }
  const allSelected = filteredEmails && filteredEmails.length > 0 && selectedIds.length === filteredEmails.length;
  const someSelected = selectedIds.length > 0 && !allSelected;
  return <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showCheckboxes && filteredEmails && filteredEmails.length > 0 && <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} className={cn(someSelected && "data-[state=checked]:bg-primary/50")} />}
            <h2 className="font-semibold capitalize">{folder}</h2>
            <span className="text-sm text-muted-foreground">
              ({filteredEmails?.length || 0})
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncEmails.isPending || !accountId}>
            <RefreshCw className={cn("h-4 w-4 mr-1", syncEmails.isPending && "animate-spin")} />
            Sync
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search emails..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Tabs value={filter} onValueChange={v => setFilter(v as typeof filter)}>
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
        {isLoading ? <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div> : filteredEmails && filteredEmails.length > 0 ? <div className="divide-y">
          {filteredEmails.map(email => <div key={email.id} className={cn("w-full text-left p-4 hover:bg-accent transition-colors cursor-pointer relative group", selectedEmail?.id === email.id && "bg-accent", !email.is_read && "bg-primary/5 border-l-2 border-l-primary")} onClick={() => onSelectEmail(email)}>
                <div className="min-w-0 overflow-hidden ">
                  {/* Checkbox */}
                  {showCheckboxes && <div className="pt-1" onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.includes(email.id)} onCheckedChange={checked => handleCheckboxChange(email.id, checked as boolean)} />
                    </div>}
                  
                  {/* Unread Indicator */}
                  {!email.is_read && <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />}
                  
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {email.contacts ? <User className="h-4 w-4 text-primary" /> : <Mail className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-sm truncate", !email.is_read && "font-semibold")}>
                        {email.direction === "inbound" ? email.from_name || email.from_email : `To: ${email.to_emails?.[0] || "Unknown"}`}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(email.received_at), {
                    addSuffix: true
                  })}
                      </span>
                    </div>
                    <p className={cn("text-sm truncate", !email.is_read && "font-medium")}>
                      {email.subject || "(No subject)"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {email.snippet}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {email.contacts && <Badge variant="secondary" className="text-xs py-0">
                          <Link2 className="h-3 w-3 mr-1" />
                          {email.contacts.first_name} {email.contacts.last_name}
                        </Badge>}
                      {email.direction === "outbound" && <Badge variant="outline" className="text-xs py-0">Sent</Badge>}
                      {/* Tracking indicators */}
                      {email.is_tracked && <div className="flex items-center gap-1.5">
                          {email.open_count && email.open_count > 0 && <Badge variant="outline" className="text-xs py-0 gap-1">
                              <Eye className="h-3 w-3" />
                              {email.open_count}
                            </Badge>}
                          {email.click_count && email.click_count > 0 && <Badge variant="outline" className="text-xs py-0 gap-1">
                              <MousePointerClick className="h-3 w-3" />
                              {email.click_count}
                            </Badge>}
                        </div>}
                      {/* Email labels */}
                      {email.email_labels && email.email_labels.split(",").slice(0, 2).map((label, i) => <LabelBadge key={i} label={label.trim()} size="sm" />)}
                    </div>
                  </div>
                </div>
                
                {/* Mark read/unread button - appears on hover */}
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={e => handleToggleRead(e as unknown as React.MouseEvent, email)}>
                        {email.is_read ? <>
                            <Mail className="h-4 w-4 mr-2" />
                            Mark as Unread
                          </> : <>
                            <MailOpen className="h-4 w-4 mr-2" />
                            Mark as Read
                          </>}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>)}
          </div> : <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
            <Mail className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">No emails found</p>
            {accountId && <Button variant="outline" size="sm" className="mt-4" onClick={handleSync}>
                Sync Emails
              </Button>}
          </div>}
      </div>
    </div>;
}