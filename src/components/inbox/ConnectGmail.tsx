import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Loader2 } from "lucide-react";
import { startGoogleOAuth } from "@/hooks/useEmailAccounts";
import { toast } from "@/hooks/use-toast";

export function ConnectGmail() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);

    try {
      setIsConnecting(true);
      await startGoogleOAuth();
    } catch (err) {
      console.error("Failed to start OAuth flow:", err);
      const message = err instanceof Error ? err.message : "Failed to connect";
      toast({
        title: "Configuration Error",
        description: message,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

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
          disabled={isConnecting || isLoading}
          className="gap-2"
        >
          {(isConnecting || isLoading) && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          <Mail className="h-4 w-4" />
          Connect Gmail
        </Button>
      </CardContent>
    </Card>
  );
}
