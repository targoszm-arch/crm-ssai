import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendEmailRequest {
  accountId: string;
  to: string[];
  subject: string;
  body: string;
  contactId?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    
    if (!googleClientId || !googleClientSecret) {
      throw new Error("Google OAuth credentials not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { accountId, to, subject, body, contactId }: SendEmailRequest = await req.json();

    if (!accountId || !to || to.length === 0 || !subject || !body) {
      throw new Error("accountId, to, subject, and body are required");
    }

    console.log(`Sending email from account: ${accountId}`);

    // Get email account
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (accountError || !account) {
      throw new Error(`Email account not found: ${accountError?.message}`);
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
        .eq("id", accountId);
    }

    // Create email in RFC 2822 format
    const emailLines = [
      `To: ${to.join(", ")}`,
      `From: ${account.email_address}`,
      `Subject: ${subject}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      body,
    ];
    const rawEmail = emailLines.join("\r\n");
    
    // Base64 encode for Gmail API (URL-safe)
    const encodedEmail = base64Encode(new TextEncoder().encode(rawEmail))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Send via Gmail API
    const sendResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encodedEmail }),
      }
    );

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error("Gmail send error:", errorText);
      throw new Error(`Failed to send email: ${sendResponse.status}`);
    }

    const sentMessage = await sendResponse.json();
    console.log(`Email sent successfully: ${sentMessage.id}`);

    // Store the sent email in our database
    const { data: storedEmail, error: storeError } = await supabase
      .from("emails")
      .insert({
        account_id: accountId,
        gmail_id: sentMessage.id,
        thread_id: sentMessage.threadId,
        contact_id: contactId || null,
        subject,
        snippet: body.substring(0, 200),
        from_email: account.email_address,
        from_name: account.email_address.split("@")[0],
        to_emails: to,
        received_at: new Date().toISOString(),
        is_read: true,
        direction: "outbound",
        labels: ["SENT"],
      })
      .select()
      .single();

    if (storeError) {
      console.error("Error storing sent email:", storeError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: sentMessage.id,
        email: storedEmail,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error sending email:", error);
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
