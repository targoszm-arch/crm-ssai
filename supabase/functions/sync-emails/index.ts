import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SyncRequest {
  accountId: string;
  maxResults?: number;
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

    const { accountId, maxResults = 50 }: SyncRequest = await req.json();

    if (!accountId) {
      throw new Error("accountId is required");
    }

    console.log(`Syncing emails for account: ${accountId}`);

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

    // Fetch emails from Gmail API
    const messagesResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!messagesResponse.ok) {
      throw new Error(`Failed to fetch messages: ${messagesResponse.status}`);
    }

    const messagesData = await messagesResponse.json();
    const messageIds = messagesData.messages || [];

    console.log(`Found ${messageIds.length} messages to sync`);

    // Get all contacts for matching
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, email");

    const emailToContactId: Record<string, string> = {};
    contacts?.forEach((c) => {
      if (c.email) {
        emailToContactId[c.email.toLowerCase()] = c.id;
      }
    });

    // Fetch and store each message
    const syncedEmails = [];
    for (const msg of messageIds.slice(0, 20)) { // Limit to 20 for performance
      try {
        // Check if already synced
        const { data: existing } = await supabase
          .from("emails")
          .select("id")
          .eq("account_id", accountId)
          .eq("gmail_id", msg.id)
          .single();

        if (existing) {
          continue;
        }

        // Fetch full message
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!msgResponse.ok) continue;

        const msgData = await msgResponse.json();

        // Extract headers
        const headers = msgData.payload?.headers || [];
        const getHeader = (name: string) => 
          headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value;

        const from = getHeader("From") || "";
        const to = getHeader("To") || "";
        const subject = getHeader("Subject") || "(No subject)";
        const date = getHeader("Date");

        // Parse from email
        const fromMatch = from.match(/<(.+?)>/) || [null, from];
        const fromEmail = fromMatch[1] || from;
        const fromName = from.replace(/<.+?>/, "").trim().replace(/"/g, "");

        // Parse to emails
        const toEmails = to.split(",").map((e: string) => {
          const match = e.match(/<(.+?)>/);
          return match ? match[1] : e.trim();
        });

        // Determine direction
        const direction = fromEmail.toLowerCase() === account.email_address.toLowerCase()
          ? "outbound"
          : "inbound";

        // Match to contact
        const matchEmail = direction === "inbound" ? fromEmail : toEmails[0];
        const contactId = emailToContactId[matchEmail?.toLowerCase() || ""] || null;

        // Insert email
        const { data: inserted, error: insertError } = await supabase
          .from("emails")
          .insert({
            account_id: accountId,
            gmail_id: msg.id,
            thread_id: msg.threadId,
            contact_id: contactId,
            subject,
            snippet: msgData.snippet,
            from_email: fromEmail,
            from_name: fromName,
            to_emails: toEmails,
            received_at: date ? new Date(date).toISOString() : new Date().toISOString(),
            is_read: !msgData.labelIds?.includes("UNREAD"),
            direction,
            labels: msgData.labelIds || [],
          })
          .select()
          .single();

        if (!insertError && inserted) {
          syncedEmails.push(inserted);
        }
      } catch (err) {
        console.error(`Error syncing message ${msg.id}:`, err);
      }
    }

    console.log(`Synced ${syncedEmails.length} new emails`);

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount: syncedEmails.length,
        emails: syncedEmails,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error syncing emails:", error);
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
