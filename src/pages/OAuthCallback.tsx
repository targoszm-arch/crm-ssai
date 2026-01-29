import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Fixed redirect URI - must match exactly what's in get-google-config and Google Cloud Console
const FIXED_REDIRECT_URI = "https://crm-ssai.lovable.app/oauth/callback";

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state"); // Contains the return path (e.g., "calendar" or "inbox")
      const error = searchParams.get("error");

      // Default return path
      const returnPath = state || "calendar";

      if (error) {
        console.error("OAuth error from Google:", error);
        setStatus("error");
        setErrorMessage(`Google OAuth error: ${error}`);
        toast({
          title: "Authentication Failed",
          description: `Google returned an error: ${error}`,
          variant: "destructive",
        });
        setTimeout(() => navigate(`/${returnPath}`), 2000);
        return;
      }

      if (!code) {
        setStatus("error");
        setErrorMessage("No authorization code received");
        toast({
          title: "Authentication Failed",
          description: "No authorization code received from Google",
          variant: "destructive",
        });
        setTimeout(() => navigate(`/${returnPath}`), 2000);
        return;
      }

      try {
        console.log("Processing OAuth callback with code...");
        
        // Call the google-auth-callback edge function with the fixed redirect URI
        const { data, error: fnError } = await supabase.functions.invoke("google-auth-callback", {
          body: {
            code,
            redirectUri: FIXED_REDIRECT_URI,
          },
        });

        if (fnError) {
          throw new Error(fnError.message);
        }

        if (!data.success) {
          throw new Error(data.error || "Failed to authenticate with Google");
        }

        setStatus("success");
        toast({
          title: "Connected Successfully",
          description: `Successfully connected ${data.email}`,
        });

        // Redirect back to the original page
        setTimeout(() => navigate(`/${returnPath}`), 1000);
      } catch (err) {
        console.error("OAuth callback error:", err);
        setStatus("error");
        const message = err instanceof Error ? err.message : "Unknown error occurred";
        setErrorMessage(message);
        toast({
          title: "Connection Failed",
          description: message,
          variant: "destructive",
        });
        setTimeout(() => navigate(`/${returnPath}`), 2000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Loader2 className={`h-6 w-6 text-primary ${status === "processing" ? "animate-spin" : ""}`} />
          </div>
          <CardTitle>
            {status === "processing" && "Connecting..."}
            {status === "success" && "Connected!"}
            {status === "error" && "Connection Failed"}
          </CardTitle>
          <CardDescription>
            {status === "processing" && "Please wait while we complete the authentication..."}
            {status === "success" && "Redirecting you back..."}
            {status === "error" && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {status === "processing" && (
            <p className="text-sm text-muted-foreground">
              Exchanging authorization code...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
