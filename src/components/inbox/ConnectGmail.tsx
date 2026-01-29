import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Loader2 } from "lucide-react";
import { useConnectGmail } from "@/hooks/useEmailAccounts";
import { toast } from "@/hooks/use-toast";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export function ConnectGmail() {
  const [isConnecting, setIsConnecting] = useState(false);
  const connectGmail = useConnectGmail();

  const handleConnect = () => {
    if (!GOOGLE_CLIENT_ID) {
      toast({
        title: "Configuration Error",
        description: "Google Client ID is not configured. Please add VITE_GOOGLE_CLIENT_ID to your environment.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);

    const redirectUri = `${window.location.origin}/inbox`;
    const scope = encodeURIComponent(
      "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email"
    );

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

    window.location.href = authUrl;
  };

  // Handle OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");

  if (code && !connectGmail.isPending && !connectGmail.isSuccess) {
    const redirectUri = `${window.location.origin}/inbox`;

    connectGmail.mutate(
      { code, redirectUri },
      {
        onSuccess: (data) => {
          // Remove code from URL
          window.history.replaceState({}, document.title, "/inbox");
          toast({
            title: "Gmail Connected",
            description: `Successfully connected ${data.email}`,
          });
        },
        onError: (error) => {
          window.history.replaceState({}, document.title, "/inbox");
          toast({
            title: "Connection Failed",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Connect Your Gmail</CardTitle>
        <CardDescription>
          Connect your Gmail account to sync emails and link them to your CRM contacts.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button
          onClick={handleConnect}
          disabled={isConnecting || connectGmail.isPending}
          className="gap-2"
        >
          {(isConnecting || connectGmail.isPending) && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          <Mail className="h-4 w-4" />
          Connect Gmail
        </Button>
      </CardContent>
    </Card>
  );
}
