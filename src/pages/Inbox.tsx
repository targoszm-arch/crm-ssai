import { useState } from "react";
import { Plus, Settings, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmailAccounts, useDisconnectEmailAccount } from "@/hooks/useEmailAccounts";
import { Email } from "@/hooks/useEmails";
import { ConnectGmail } from "@/components/inbox/ConnectGmail";
import { EmailList } from "@/components/inbox/EmailList";
import { EmailThread } from "@/components/inbox/EmailThread";
import { ComposeEmail } from "@/components/inbox/ComposeEmail";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";

export default function Inbox() {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const { data: accounts, isLoading: accountsLoading } = useEmailAccounts();
  const disconnectAccount = useDisconnectEmailAccount();

  const hasConnectedAccount = accounts && accounts.length > 0;
  const currentAccount = accounts?.[0] || null;

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

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasConnectedAccount) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ConnectGmail />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Inbox</h1>
          {currentAccount && (
            <span className="text-sm text-muted-foreground">
              ({currentAccount.email_address})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setComposeOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Compose
          </Button>
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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Email List */}
        <div className="w-96 border-r flex-shrink-0 overflow-hidden">
          <EmailList
            accounts={accounts || []}
            selectedEmail={selectedEmail}
            onSelectEmail={setSelectedEmail}
          />
        </div>

        {/* Email Thread */}
        <div className="flex-1 overflow-hidden">
          {selectedEmail ? (
            <EmailThread
              email={selectedEmail}
              account={currentAccount}
              onClose={() => setSelectedEmail(null)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Mail className="h-16 w-16 mb-4 opacity-30" />
              <p>Select an email to view</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Dialog */}
      <ComposeEmail
        open={composeOpen}
        onOpenChange={setComposeOpen}
        account={currentAccount}
      />
    </div>
  );
}
