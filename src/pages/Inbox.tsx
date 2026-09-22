import { useState, useEffect, useRef } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Plus, Settings, Mail, RefreshCw, Loader2, FileSignature, LayoutGrid, List, PanelLeftClose, PanelLeftOpen, Linkedin } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmailAccounts, useDisconnectEmailAccount, startGoogleOAuth } from "@/hooks/useEmailAccounts";
import { Email, useSyncEmails, useBulkMarkEmailsRead, useArchiveEmails, useEmailLabelOptions, EmailFilters } from "@/hooks/useEmails";
import { LinkedInMessage } from "@/hooks/useLinkedInMessages";
import { ConnectGmail } from "@/components/inbox/ConnectGmail";
import { EmailList } from "@/components/inbox/EmailList";
import { EmailThread } from "@/components/inbox/EmailThread";
import { ComposeEmail } from "@/components/inbox/ComposeEmail";
import { LinkedInMessageList } from "@/components/inbox/LinkedInMessageList";
import { LinkedInMessageView } from "@/components/inbox/LinkedInMessageView";
import { SignatureSettings } from "@/components/inbox/SignatureSettings";
import { InboxSidebar, type EmailFolder } from "@/components/inbox/InboxSidebar";
import { TemplatesPanel } from "@/components/inbox/TemplatesPanel";
import { EmailTemplate } from "@/hooks/useEmailTemplates";
import { BulkActionBar } from "@/components/inbox/BulkActionBar";
import { InboxFilters } from "@/components/inbox/InboxFilters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageActions } from "@/components/layout/PageActions";
import PageShell from "@/components/layout/PageShell";

type InboxTab = "email" | "linkedin";
// How stale the mailbox has to be before opening the Inbox starts a background sync.
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

type SelectedItem = { type: "email"; item: Email } | { type: "linkedin"; item: LinkedInMessage } | null;
type ViewMode = "split" | "full";

const folderOptions: { value: EmailFolder; label: string }[] = [
  { value: "inbox", label: "Inbox" },
  { value: "sent", label: "Sent" },
  { value: "drafts", label: "Drafts" },
  { value: "archive", label: "Archive" },
];

export default function Inbox() {
  const isMobile = useIsMobile();
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  // Collapsed sidebar is a per-browser preference, not account state.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("inbox-sidebar-collapsed") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("inbox-sidebar-collapsed", sidebarCollapsed ? "1" : "0"); } catch { /* private mode */ }
  }, [sidebarCollapsed]);
  const [composeTemplate, setComposeTemplate] = useState<EmailTemplate | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InboxTab>("email");
  const [isSyncingMeetAlfred, setIsSyncingMeetAlfred] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const autoSyncTriggered = useRef(false);
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("inbox-view-mode") as ViewMode) || "split";
  });
  const [currentFolder, setCurrentFolder] = useState<EmailFolder>("inbox");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [filters, setFilters] = useState<EmailFilters>({});

  const { data: accounts, isLoading: accountsLoading } = useEmailAccounts();
  const { data: availableLabels = [] } = useEmailLabelOptions();
  const disconnectAccount = useDisconnectEmailAccount();
  const syncEmails = useSyncEmails();
  const bulkMarkRead = useBulkMarkEmailsRead();
  const archiveEmails = useArchiveEmails();
  const queryClient = useQueryClient();

  const hasConnectedAccount = accounts && accounts.length > 0;
  const currentAccount = accounts?.[0] || null;
  const isSyncing = isAutoSyncing || syncEmails.isPending;

  // Force full mode on mobile
  const effectiveViewMode = isMobile ? "full" : viewMode;

  useEffect(() => {
    localStorage.setItem("inbox-view-mode", viewMode);
  }, [viewMode]);

  // Opening the Inbox used to kick off a full 30-day, 500-message Gmail sync every
  // single time — the ref guarding it is per-mount, so navigating away and back re-ran
  // it. That is not how a mail client behaves: Gmail syncs in the background and the UI
  // just reads what is already stored.
  //
  // Now the sync is only started when one is actually due, judged by the account's
  // last_sync_at, and it asks for no daysBack so the function pulls incrementally from
  // that point. Opening the Inbox twice in a minute reads the database and nothing more.
  useEffect(() => {
    if (activeTab !== "email" || !currentAccount) return;
    if (autoSyncTriggered.current || isAutoSyncing) return;

    const lastSync = currentAccount.last_sync_at
      ? new Date(currentAccount.last_sync_at).getTime()
      : 0;
    const isDue = Date.now() - lastSync > AUTO_SYNC_INTERVAL_MS;
    if (!isDue) return;

    autoSyncTriggered.current = true;
    setIsAutoSyncing(true);

    syncEmails.mutate(
      { accountId: currentAccount.id, maxResults: 500 },
      {
        onSuccess: (data) => {
          // "0 new, 500 already synced" is not news. Only say something when the
          // sync actually changed what is on screen.
          if (data.syncedCount > 0 || data.errorCount > 0) {
            toast({
              title: "Inbox updated",
              description: `${data.syncedCount} new${
                data.errorCount > 0 ? `, ${data.errorCount} errors` : ""
              }`,
            });
          }
          setIsAutoSyncing(false);
        },
        onError: (error) => {
          toast({
            title: "Email Sync Failed",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
          setIsAutoSyncing(false);
        },
      }
    );
  }, [activeTab, currentAccount, syncEmails, isAutoSyncing]);

  const handleSyncMeetAlfred = async () => {
    setIsSyncingMeetAlfred(true);
    try {
      const { data, error } = await supabase.functions.invoke("meetalfred-sync", { body: {} });
      if (error) throw error;
      const r = data?.results;
      const parts: string[] = [];
      if (r?.campaigns?.synced) parts.push(`${r.campaigns.synced} campaigns`);
      if (r?.replies?.synced) parts.push(`${r.replies.synced} replies`);
      if (r?.connections?.synced) parts.push(`${r.connections.synced} connections`);
      if (r?.leads?.synced) parts.push(`${r.leads.synced} leads`);
      toast({
        title: "Meet Alfred Sync Complete",
        description: parts.length ? `Synced: ${parts.join(", ")}` : "No new data to sync",
      });
      queryClient.invalidateQueries({ queryKey: ["linkedin-messages"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    } catch (error) {
      toast({ title: "Sync Failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setIsSyncingMeetAlfred(false);
    }
  };

  const handleDisconnect = (accountId: string, emailAddress: string) => {
    // email_accounts cascade-deletes emails and calendar_events on delete — this
    // permanently destroys every synced email and event for the account, not just
    // the connection. A broken/expired token is not a reason to disconnect; use
    // Reconnect instead, which updates the same account's tokens in place.
    const confirmed = window.confirm(
      `Disconnect ${emailAddress}? This permanently deletes every synced email and calendar event for this account from the CRM — it cannot be undone. If the connection is just broken (expired or invalid token), use Reconnect instead.`
    );
    if (!confirmed) return;
    disconnectAccount.mutate(accountId, {
      onSuccess: () => toast({ title: "Account Disconnected" }),
      onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
    });
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await startGoogleOAuth();
    } catch (error) {
      toast({
        title: "Reconnect Failed",
        description: error instanceof Error ? error.message : "Failed to start reconnect",
        variant: "destructive",
      });
      setIsReconnecting(false);
    }
  };

  const handleSelectEmail = (email: Email) => setSelectedItem({ type: "email", item: email });
  const handleSelectLinkedInMessage = (message: LinkedInMessage) => setSelectedItem({ type: "linkedin", item: message });
  const handleCloseDetail = () => setSelectedItem(null);

  const handleBulkMarkRead = () => {
    bulkMarkRead.mutate({ emailIds: selectedEmails, isRead: true }, {
      onSuccess: () => { toast({ title: "Marked as read" }); setSelectedEmails([]); }
    });
  };

  const handleBulkMarkUnread = () => {
    bulkMarkRead.mutate({ emailIds: selectedEmails, isRead: false }, {
      onSuccess: () => { toast({ title: "Marked as unread" }); setSelectedEmails([]); }
    });
  };

  const handleBulkArchive = () => {
    archiveEmails.mutate({ emailIds: selectedEmails }, {
      onSuccess: () => { toast({ title: "Archived" }); setSelectedEmails([]); }
    });
  };

  if (accountsLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const showConnectPrompt = activeTab === "email" && !hasConnectedAccount;

  return (
    <PageShell variant="fill">
      <PageActions>
        {activeTab === "linkedin" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncMeetAlfred}
            disabled={isSyncingMeetAlfred}
          >
            {isSyncingMeetAlfred ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-4 w-4" />
            )}
            Sync Meet Alfred
          </Button>
        )}
        {activeTab === "email" && (
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New message
          </Button>
        )}
      </PageActions>

      {/* Header - responsive stacking.
          The three-pane redesign kept the title block and dropped every control
          that used to sit beside it. The handlers all survived, so the LinkedIn
          tab, Meet Alfred sync, signature settings, mailbox disconnect and the
          split/full toggle were still in the file — just unreachable, because
          nothing called setActiveTab, setViewMode, setSignatureOpen or
          handleDisconnect any more. They are wired back up here, in the new
          header's own idiom rather than the old one's. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <PageHeader
            title="Emails"
            description="Mailbox and LinkedIn in one workspace — folders, drafts, syncing and full thread reading."
          />
          {isSyncing && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Syncing…</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as InboxTab);
              setSelectedItem(null);
              setSelectedEmails([]);
            }}
          >
            <TabsList>
              <TabsTrigger value="email" className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Email</span>
              </TabsTrigger>
              <TabsTrigger value="linkedin" className="flex items-center gap-1.5">
                <Linkedin className="h-4 w-4" />
                <span className="hidden sm:inline">LinkedIn</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {activeTab === "email" && hasConnectedAccount && !isMobile && (
            <div className="hidden md:flex items-center border rounded-md">
              <Button
                variant={viewMode === "split" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-r-none"
                onClick={() => setViewMode("split")}
                aria-label="Split view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "full" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-l-none"
                onClick={() => setViewMode("full")}
                aria-label="Full view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          )}

          {activeTab === "email" && hasConnectedAccount && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mailbox settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSignatureOpen(true)}>
                  <FileSignature className="h-4 w-4 mr-2" />
                  Email Signature
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleReconnect} disabled={isReconnecting}>
                  {isReconnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Reconnect Gmail
                </DropdownMenuItem>
                {accounts?.map((account) => (
                  <DropdownMenuItem
                    key={account.id}
                    onClick={() => handleDisconnect(account.id, account.email_address)}
                    className="text-destructive"
                  >
                    Disconnect {account.email_address}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {currentAccount && activeTab === "email" && !isMobile && (
            <span className="text-sm text-muted-foreground">{currentAccount.email_address}</span>
          )}

          {/* Same row as the tabs/view toggle/settings, not a second bar
              underneath -- it used to render in its own bordered strip below
              the header, which is the same "why is this its own row" problem
              as everywhere else in this app that got fixed today. */}
          {activeTab === "email" && hasConnectedAccount && (
            <InboxFilters filters={filters} onChange={setFilters} availableLabels={availableLabels} />
          )}
        </div>
      </div>

      {/* Mobile folder dropdown */}
      {isMobile && activeTab === "email" && hasConnectedAccount && (
        <div className="px-4 py-2 border-b">
          <Select value={currentFolder} onValueChange={(v) => { setCurrentFolder(v as EmailFolder); setSelectedItem(null); }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              {folderOptions.map((folder) => (
                <SelectItem key={folder.value} value={folder.value}>
                  {folder.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedEmails.length > 0 && (
        <div className="flex justify-center py-2 border-b bg-muted/50">
          <BulkActionBar
            selectedCount={selectedEmails.length}
            onMarkRead={handleBulkMarkRead}
            onMarkUnread={handleBulkMarkUnread}
            onArchive={handleBulkArchive}
            onClearSelection={() => setSelectedEmails([])}
            isLoading={bulkMarkRead.isPending || archiveEmails.isPending}
          />
        </div>
      )}

      {/* Content */}
      {showConnectPrompt ? (
        <div className="flex items-center justify-center flex-1 p-8"><ConnectGmail /></div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Desktop InboxSidebar */}
          {!isMobile && activeTab === "email" && (
            <div
              className={cn(
                "m-4 mr-0 flex shrink-0 flex-col overflow-y-auto rounded-xl border bg-card transition-[width] duration-200",
                sidebarCollapsed ? "w-12" : "w-[350px]"
              )}
            >
              <InboxSidebar
                currentFolder={currentFolder}
                onFolderChange={(f) => { setCurrentFolder(f); setSelectedItem(null); }}
                collapsed={sidebarCollapsed}
              />
              {!sidebarCollapsed && (
                <TemplatesPanel
                  onUseTemplate={(template) => {
                    setComposeTemplate(template);
                    setComposeOpen(true);
                  }}
                />
              )}
            </div>
          )}
          
          {/* Email/LinkedIn list - constrained width */}
          <div className={cn(
            "border-r flex-shrink-0 overflow-hidden flex flex-col min-w-0",
            effectiveViewMode === "split" ? "m-4 w-[400px] rounded-xl border bg-card" : "flex-1 max-w-2xl"
          )}>
            {activeTab === "email" ? (
              <EmailList 
                accounts={accounts || []} 
                selectedEmail={selectedItem?.type === "email" ? selectedItem.item : null} 
                onSelectEmail={handleSelectEmail}
                folder={currentFolder}
                filters={filters}
                selectedIds={selectedEmails}
                onSelectionChange={setSelectedEmails}
                showCheckboxes={true}
              />
            ) : (
              <LinkedInMessageList
                linkedOnly={false}
                selectedMessage={selectedItem?.type === "linkedin" ? selectedItem.item : null}
                onSelectMessage={handleSelectLinkedInMessage}
              />
            )}
          </div>
          
          {/* Split view detail panel */}
          {effectiveViewMode === "split" && (
            <div className="m-4 ml-0 flex-1 overflow-hidden rounded-xl border bg-card">
              {selectedItem?.type === "email" ? (
                <EmailThread email={selectedItem.item} account={currentAccount} onClose={handleCloseDetail} />
              ) : selectedItem?.type === "linkedin" ? (
                <LinkedInMessageView message={selectedItem.item} onClose={handleCloseDetail} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Mail className="h-16 w-16 mb-4 opacity-30" /><p>Select an email to view</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full mode sheet overlay */}
      {effectiveViewMode === "full" && selectedItem?.type === "email" && (
        <Sheet open={true} onOpenChange={() => setSelectedItem(null)}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
            <EmailThread email={selectedItem.item} account={currentAccount} onClose={handleCloseDetail} />
          </SheetContent>
        </Sheet>
      )}

      {/* LinkedIn message sheet overlay for full mode */}
      {effectiveViewMode === "full" && selectedItem?.type === "linkedin" && (
        <Sheet open={true} onOpenChange={() => setSelectedItem(null)}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
            <LinkedInMessageView message={selectedItem.item} onClose={handleCloseDetail} />
          </SheetContent>
        </Sheet>
      )}

      <ComposeEmail
        open={composeOpen}
        onOpenChange={(next) => {
          setComposeOpen(next);
          if (!next) setComposeTemplate(null);
        }}
        account={currentAccount}
        initialTemplate={composeTemplate}
      />
      <SignatureSettings open={signatureOpen} onOpenChange={setSignatureOpen} />
    </PageShell>
  );
}
