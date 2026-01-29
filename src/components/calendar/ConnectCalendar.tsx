import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function ConnectCalendar() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);

    try {
      // Fetch Google config from edge function (Client ID and fixed redirect URI)
      const { data, error } = await supabase.functions.invoke("get-google-config");

      if (error) {
        throw new Error(error.message);
      }

      if (!data.clientId || !data.redirectUri) {
        throw new Error("Invalid configuration received from server");
      }

      setIsConnecting(true);

      const scope = encodeURIComponent(
        "https://www.googleapis.com/auth/gmail.readonly " +
        "https://www.googleapis.com/auth/gmail.send " +
        "https://www.googleapis.com/auth/userinfo.email " +
        "https://www.googleapis.com/auth/calendar " +
        "https://www.googleapis.com/auth/calendar.events"
      );

      // Use state parameter to tell the callback where to redirect after auth
      const state = "calendar";

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${data.clientId}&redirect_uri=${encodeURIComponent(data.redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;

      window.location.href = authUrl;
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
          <Calendar className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Connect Your Google Calendar</CardTitle>
        <CardDescription>
          Connect your Google account to sync calendar events and schedule meetings with your CRM contacts.
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
          <Calendar className="h-4 w-4" />
          Connect Google Calendar
        </Button>
      </CardContent>
    </Card>
  );
}
