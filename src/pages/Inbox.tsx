import { useState } from "react";
import { Plus, Settings, Mail, Linkedin, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmailAccounts, useDisconnectEmailAccount } from "@/hooks/useEmailAccounts";
import { Email } from "@/hooks/useEmails";
import { LinkedInMessage } from "@/hooks/useLinkedInMessages";
import { ConnectGmail } from "@/components/inbox/ConnectGmail";
import { EmailList } from "@/components/inbox/EmailList";
import { EmailThread } from "@/components/inbox/EmailThread";
import { ComposeEmail } from "@/components/inbox/ComposeEmail";
import { LinkedInMessageList } from "@/components/inbox/LinkedInMessageList";
import { LinkedInMessageView } from "@/components/inbox/LinkedInMessageView";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type InboxTab = "email" | "linkedin";
type SelectedItem = { type: "email"; item: Email } | { type: "linkedin"; item: LinkedInMessage } | null;

export default function Inbox() {
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InboxTab>("email");
  const [isSyncingMeetAlfred, setIsSyncingMeetAlfred] = useState(false);

  const { data: accounts, isLoading: accountsLoading } = useEmailAccounts();
  const disconnectAccount = useDisconnectEmailAccount();
  const queryClient = useQueryClient();

  const hasConnectedAccount = accounts && accounts.length > 0;
  const currentAccount = accounts?.[0] || null;

  const handleSyncMeetAlfred = async () => {
    setIsSyncingMeetAlfred(true);
    try {
      const { data, error } = await supabase.functions.invoke("meetalfred-sync", {
        body: {},
      });

      if (error) throw error;

      const results = data?.results;
      toast({
        title: "Meet Alfred Sync Complete",
        description: `Synced ${results?.replies?.synced || 0} replies, ${results?.connections?.synced || 0} connections, ${results?.leads?.synced || 0} leads`,
      });

      // Refresh LinkedIn messages
      queryClient.invalidateQueries({ queryKey: ["linkedin-messages"] });
      queryClient.invalidateQueries({ queryKey: ["linkedin-connections"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (error) {
      console.error("Meet Alfred sync error:", error);
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync with Meet Alfred",
        variant: "destructive",
      });
    } finally {
      setIsSyncingMeetAlfred(false);
    }
  };

  const handleDisconnect = (accountId: string) => {
    disconnectAccount.mutate(accountId, {
      onSuccess: () => {
        toast({
          title: "Account Disconnected",
          description: "Your email account has been disconnected.",
        });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const handleSelectEmail = (email: Email) => {
    setSelectedItem({ type: "email", item: email });
  };

  const handleSelectLinkedInMessage = (message: LinkedInMessage) => {
    setSelectedItem({ type: "linkedin", item: message });
  };

  const handleCloseDetail = () => {
    setSelectedItem(null);
  };

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show connect prompt only for email tab when no account
  const showConnectPrompt = activeTab === "email" && !hasConnectedAccount;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Inbox</h1>
          </div>
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as InboxTab); setSelectedItem(null); }}>
            <TabsList>
              <TabsTrigger value="email" className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="linkedin" className="flex items-center gap-1.5">
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "email" && hasConnectedAccount && (
            <Button onClick={() => setComposeOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Compose
            </Button>
          )}
          {activeTab === "linkedin" && (
            <Button
              variant="outline"
              onClick={handleSyncMeetAlfred}
              disabled={isSyncingMeetAlfred}
            >
              {isSyncingMeetAlfred ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1.5" />
              )}
              Sync Meet Alfred
            </Button>
          )}
          {activeTab === "email" && hasConnectedAccount && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {accounts?.map((account) => (
                  <DropdownMenuItem
                    key={account.id}
                    onClick={() => handleDisconnect(account.id)}
                    className="text-destructive"
                  >
                    Disconnect {account.email_address}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {currentAccount && activeTab === "email" && (
            <span className="text-sm text-muted-foreground">
              {currentAccount.email_address}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {showConnectPrompt ? (
        <div className="flex items-center justify-center flex-1 p-8">
          <ConnectGmail />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Message List */}
          <div className="w-96 border-r flex-shrink-0 overflow-hidden flex flex-col">
            {activeTab === "email" ? (
              <EmailList
                accounts={accounts || []}
                selectedEmail={selectedItem?.type === "email" ? selectedItem.item : null}
                onSelectEmail={handleSelectEmail}
              />
            ) : (
              <div className="flex-1 overflow-auto">
                <LinkedInMessageList
                  search=""
                  linkedOnly={false}
                  selectedMessage={selectedItem?.type === "linkedin" ? selectedItem.item : null}
                  onSelectMessage={handleSelectLinkedInMessage}
                />
              </div>
            )}
          </div>

          {/* Detail View */}
          <div className="flex-1 overflow-hidden">
            {selectedItem?.type === "email" ? (
              <EmailThread
                email={selectedItem.item}
                account={currentAccount}
                onClose={handleCloseDetail}
              />
            ) : selectedItem?.type === "linkedin" ? (
              <LinkedInMessageView
                message={selectedItem.item}
                onClose={handleCloseDetail}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                {activeTab === "email" ? (
                  <>
                    <Mail className="h-16 w-16 mb-4 opacity-30" />
                    <p>Select an email to view</p>
                  </>
                ) : (
                  <>
                    <Linkedin className="h-16 w-16 mb-4 opacity-30" />
                    <p>Select a LinkedIn message to view</p>
                    <p className="text-sm mt-2 max-w-md text-center">
                      Messages are synced from your browser extension. Install the extension to capture LinkedIn conversations.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compose Dialog */}
      <ComposeEmail
        open={composeOpen}
        onOpenChange={setComposeOpen}
        account={currentAccount}
      />
    </div>
  );
}
