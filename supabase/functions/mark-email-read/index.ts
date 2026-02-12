import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MarkReadRequest {
  emailId: string;
  isRead: boolean;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    
    if (!googleClientId || !googleClientSecret) {
      throw new Error("Google OAuth credentials not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { emailId, isRead }: MarkReadRequest = await req.json();

    if (!emailId) {
      throw new Error("emailId is required");
    }

    console.log(`Marking email ${emailId} as ${isRead ? 'read' : 'unread'}`);

    // Get email and its account
    const { data: email, error: emailError } = await supabase
      .from("emails")
      .select("*, email_accounts!emails_account_id_fkey(*)")
      .eq("id", emailId)
      .single();

    if (emailError || !email) {
      throw new Error(`Email not found: ${emailError?.message}`);
    }

    const account = email.email_accounts;
    if (!account) {
      throw new Error("Email account not found");
    }

    let accessToken = account.access_token;

    // Check if token is expired and refresh if needed
    if (account.expires_at && new Date(account.expires_at) < new Date()) {
      if (!account.refresh_token) {
        throw new Error("Token expired and no refresh token available");
      }

      console.log("Refreshing access token...");

      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          refresh_token: account.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error("Failed to refresh token");
      }

      const tokens = await refreshResponse.json();
      accessToken = tokens.access_token;

      // Update stored token
      await supabase
        .from("email_accounts")
        .update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        })
        .eq("id", account.id);
    }

    // Call Gmail API to modify labels
    // Mark as read: remove UNREAD label
    // Mark as unread: add UNREAD label
    const modifyBody = isRead
      ? { removeLabelIds: ["UNREAD"] }
      : { addLabelIds: ["UNREAD"] };

    console.log(`Calling Gmail API to ${isRead ? 'remove' : 'add'} UNREAD label for message ${email.gmail_id}`);

    const gmailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.gmail_id}/modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(modifyBody),
      }
    );

    if (!gmailResponse.ok) {
      const errorText = await gmailResponse.text();
      console.error("Gmail API error:", errorText);
      throw new Error(`Failed to update Gmail: ${gmailResponse.status}`);
    }

    const gmailResult = await gmailResponse.json();
    console.log("Gmail API response:", gmailResult);

    // Update local database
    const { error: updateError } = await supabase
      .from("emails")
      .update({
        is_read: isRead,
        labels: gmailResult.labelIds || email.labels,
      })
      .eq("id", emailId);

    if (updateError) {
      console.error("Error updating local database:", updateError);
      throw new Error(`Failed to update local database: ${updateError.message}`);
    }

    console.log(`Successfully marked email ${emailId} as ${isRead ? 'read' : 'unread'}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailId,
        isRead,
        labels: gmailResult.labelIds,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error marking email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
