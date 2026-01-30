import { useState, useEffect, useRef } from "react";
import { Plus, Settings, Mail, Linkedin, RefreshCw, Loader2, FileSignature, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useEmailAccounts, useDisconnectEmailAccount } from "@/hooks/useEmailAccounts";
import { Email, useSyncEmails, useBulkMarkEmailsRead, useArchiveEmails, EmailFilters } from "@/hooks/useEmails";
import { LinkedInMessage } from "@/hooks/useLinkedInMessages";
import { ConnectGmail } from "@/components/inbox/ConnectGmail";
import { EmailList } from "@/components/inbox/EmailList";
import { EmailThread } from "@/components/inbox/EmailThread";
import { ComposeEmail } from "@/components/inbox/ComposeEmail";
import { LinkedInMessageList } from "@/components/inbox/LinkedInMessageList";
import { LinkedInMessageView } from "@/components/inbox/LinkedInMessageView";
import { SignatureSettings } from "@/components/inbox/SignatureSettings";
import { InboxSidebar, type EmailFolder } from "@/components/inbox/InboxSidebar";
import { InboxFilters } from "@/components/inbox/InboxFilters";
import { BulkActionBar } from "@/components/inbox/BulkActionBar";
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

type InboxTab = "email" | "linkedin";
type SelectedItem = { type: "email"; item: Email } | { type: "linkedin"; item: LinkedInMessage } | null;
type ViewMode = "split" | "full";

export default function Inbox() {
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InboxTab>("email");
  const [isSyncingMeetAlfred, setIsSyncingMeetAlfred] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const autoSyncTriggered = useRef(false);
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("inbox-view-mode") as ViewMode) || "split";
  });
  const [currentFolder, setCurrentFolder] = useState<EmailFolder>("inbox");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [filters, setFilters] = useState<EmailFilters>({});

  const { data: accounts, isLoading: accountsLoading } = useEmailAccounts();
  const disconnectAccount = useDisconnectEmailAccount();
  const syncEmails = useSyncEmails();
  const bulkMarkRead = useBulkMarkEmailsRead();
  const archiveEmails = useArchiveEmails();
  const queryClient = useQueryClient();

  const hasConnectedAccount = accounts && accounts.length > 0;
  const currentAccount = accounts?.[0] || null;
  const isSyncing = isAutoSyncing || syncEmails.isPending;

  useEffect(() => {
    localStorage.setItem("inbox-view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (activeTab === "email" && currentAccount && !autoSyncTriggered.current && !isAutoSyncing) {
      autoSyncTriggered.current = true;
      setIsAutoSyncing(true);
      
      syncEmails.mutate(
        { accountId: currentAccount.id, maxResults: 100, daysBack: 1 },
        {
          onSuccess: (data) => {
            if (data.syncedCount > 0) {
              toast({
                title: "Inbox Updated",
                description: `${data.syncedCount} new email${data.syncedCount > 1 ? 's' : ''} synced`,
              });
            }
            setIsAutoSyncing(false);
          },
          onError: () => setIsAutoSyncing(false),
        }
      );
    }
  }, [activeTab, currentAccount, syncEmails, isAutoSyncing]);

  const handleSyncMeetAlfred = async () => {
    setIsSyncingMeetAlfred(true);
    try {
      const { data, error } = await supabase.functions.invoke("meetalfred-sync", { body: {} });
      if (error) throw error;
      toast({ title: "Meet Alfred Sync Complete", description: `Synced messages` });
      queryClient.invalidateQueries({ queryKey: ["linkedin-messages"] });
    } catch (error) {
      toast({ title: "Sync Failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setIsSyncingMeetAlfred(false);
    }
  };

  const handleDisconnect = (accountId: string) => {
    disconnectAccount.mutate(accountId, {
      onSuccess: () => toast({ title: "Account Disconnected" }),
      onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
    });
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Inbox</h1>
            {isSyncing && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground ml-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Syncing...</span>
              </div>
            )}
          </div>
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as InboxTab); setSelectedItem(null); setSelectedEmails([]); }}>
            <TabsList>
              <TabsTrigger value="email" className="flex items-center gap-1.5"><Mail className="h-4 w-4" />Email</TabsTrigger>
              <TabsTrigger value="linkedin" className="flex items-center gap-1.5"><Linkedin className="h-4 w-4" />LinkedIn</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "email" && hasConnectedAccount && (
            <>
              <div className="flex items-center border rounded-md">
                <Button variant={viewMode === "split" ? "secondary" : "ghost"} size="icon" className="h-8 w-8 rounded-r-none" onClick={() => setViewMode("split")}><LayoutGrid className="h-4 w-4" /></Button>
                <Button variant={viewMode === "full" ? "secondary" : "ghost"} size="icon" className="h-8 w-8 rounded-l-none" onClick={() => setViewMode("full")}><List className="h-4 w-4" /></Button>
              </div>
              <Button onClick={() => setComposeOpen(true)}><Plus className="h-4 w-4 mr-1" />Compose</Button>
            </>
          )}
          {activeTab === "linkedin" && (
            <Button variant="outline" onClick={handleSyncMeetAlfred} disabled={isSyncingMeetAlfred}>
              {isSyncingMeetAlfred ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}Sync Meet Alfred
            </Button>
          )}
          {activeTab === "email" && hasConnectedAccount && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSignatureOpen(true)}><FileSignature className="h-4 w-4 mr-2" />Email Signature</DropdownMenuItem>
                <DropdownMenuSeparator />
                {accounts?.map((account) => (
                  <DropdownMenuItem key={account.id} onClick={() => handleDisconnect(account.id)} className="text-destructive">Disconnect {account.email_address}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {currentAccount && activeTab === "email" && <span className="text-sm text-muted-foreground">{currentAccount.email_address}</span>}
        </div>
      </div>

      {/* Filters Bar */}
      {activeTab === "email" && hasConnectedAccount && (
        <div className="px-4 py-2 border-b bg-muted/30">
          <InboxFilters filters={filters} onChange={setFilters} />
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
          {activeTab === "email" && (
            <InboxSidebar currentFolder={currentFolder} onFolderChange={(f) => { setCurrentFolder(f); setSelectedItem(null); }} />
          )}
          <div className={cn("border-r flex-shrink-0 overflow-hidden flex flex-col", viewMode === "split" ? "w-96" : "flex-1")}>
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
              <div className="flex-1 overflow-auto">
                <LinkedInMessageList search="" linkedOnly={false} selectedMessage={selectedItem?.type === "linkedin" ? selectedItem.item : null} onSelectMessage={handleSelectLinkedInMessage} />
              </div>
            )}
          </div>
          {viewMode === "split" && (
            <div className="flex-1 overflow-hidden">
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

      {viewMode === "full" && selectedItem?.type === "email" && (
        <Sheet open={true} onOpenChange={() => setSelectedItem(null)}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
            <EmailThread email={selectedItem.item} account={currentAccount} onClose={handleCloseDetail} />
          </SheetContent>
        </Sheet>
      )}

      <ComposeEmail open={composeOpen} onOpenChange={setComposeOpen} account={currentAccount} />
      <SignatureSettings open={signatureOpen} onOpenChange={setSignatureOpen} />
    </div>
  );
}
