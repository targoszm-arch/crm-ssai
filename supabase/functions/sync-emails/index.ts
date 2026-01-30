import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SyncRequest {
  accountId: string;
  maxResults?: number;
  daysBack?: number;
}

interface PayloadPart {
  mimeType: string;
  body?: { data?: string; size?: number };
  parts?: PayloadPart[];
}

// Decode base64url encoded string (Gmail uses URL-safe base64)
function decodeBase64Url(data: string): string {
  try {
    // Convert URL-safe base64 to regular base64
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const bytes = base64Decode(padded);
    return new TextDecoder().decode(bytes);
  } catch (e) {
    console.error('Error decoding base64:', e);
    return '';
  }
}

// Recursively extract email body from Gmail payload
function extractEmailBody(payload: PayloadPart, preferredMimeType: string): string | null {
  // Check if body exists at this level with matching mime type
  if (payload.body?.data && payload.mimeType === preferredMimeType) {
    return decodeBase64Url(payload.body.data);
  }

  // If this is a multipart message, search through parts
  if (payload.parts && payload.parts.length > 0) {
    // First, try to find the preferred type in nested parts
    for (const part of payload.parts) {
      const result = extractEmailBody(part, preferredMimeType);
      if (result) return result;
    }
  }

  return null;
}

// Extract body with fallback: try HTML first, then plain text
function getEmailBodyHtml(payload: PayloadPart): string | null {
  // Try to get HTML body first
  const htmlBody = extractEmailBody(payload, 'text/html');
  if (htmlBody) return htmlBody;

  // Fallback to plain text and wrap in <pre> for display
  const textBody = extractEmailBody(payload, 'text/plain');
  if (textBody) {
    // Convert plain text to simple HTML (escape HTML entities and preserve formatting)
    const escaped = textBody
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return `<div style="white-space: pre-wrap; font-family: sans-serif;">${escaped}</div>`;
  }

  return null;
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

    const { accountId, maxResults = 2000, daysBack = 100 }: SyncRequest = await req.json();

    if (!accountId) {
      throw new Error("accountId is required");
    }

    console.log(`Syncing emails for account: ${accountId}, maxResults: ${maxResults}, daysBack: ${daysBack}`);

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

    // Calculate date filter (100 days back)
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - daysBack);
    const afterTimestamp = Math.floor(afterDate.getTime() / 1000);
    
    // Gmail query: messages after date from INBOX or SENT
    const query = `after:${afterTimestamp}`;
    
    console.log(`Fetching emails with query: ${query}`);

    // Fetch messages with pagination (Gmail max 500 per request)
    let allMessageIds: { id: string; threadId: string }[] = [];
    let pageToken: string | undefined;
    const pageSize = 500;
    
    do {
      // Use Gmail query to get messages from all folders (INBOX OR SENT OR DRAFTS)
      // Don't use labelIds - it behaves as AND which breaks multi-folder sync
      const gmailQuery = `after:${afterTimestamp} (in:inbox OR in:sent OR in:drafts)`;
      
      const params = new URLSearchParams({
        maxResults: String(pageSize),
        q: gmailQuery,
      });
      
      if (pageToken) {
        params.append("pageToken", pageToken);
      }
      
      const messagesResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!messagesResponse.ok) {
        const errorText = await messagesResponse.text();
        console.error("Gmail API error:", errorText);
        throw new Error(`Failed to fetch messages: ${messagesResponse.status}`);
      }

      const messagesData = await messagesResponse.json();
      const messages = messagesData.messages || [];
      allMessageIds = allMessageIds.concat(messages);
      pageToken = messagesData.nextPageToken;
      
      console.log(`Fetched page with ${messages.length} messages, total so far: ${allMessageIds.length}`);
      
      // Stop if we've reached maxResults
      if (allMessageIds.length >= maxResults) {
        allMessageIds = allMessageIds.slice(0, maxResults);
        break;
      }
    } while (pageToken);

    console.log(`Found ${allMessageIds.length} messages to sync (last ${daysBack} days)`);

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
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const msg of allMessageIds) {
      try {
        // Check if already synced
        const { data: existing } = await supabase
          .from("emails")
          .select("id")
          .eq("account_id", accountId)
          .eq("gmail_id", msg.id)
          .single();

        if (existing) {
          skippedCount++;
          continue;
        }

        // Fetch full message
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!msgResponse.ok) {
          errorCount++;
          continue;
        }

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

        // Determine folder based on Gmail labels (order matters: draft > sent > inbox)
        const labelIds: string[] = msgData.labelIds || [];
        let folder = "inbox";
        
        // Check drafts first
        if (labelIds.includes("DRAFT")) {
          folder = "drafts";
        } else if (direction === "outbound" || labelIds.includes("SENT")) {
          folder = "sent";
        } else if (labelIds.includes("TRASH")) {
          folder = "trash";
        } else if (!labelIds.includes("INBOX") && !labelIds.includes("SENT") && !labelIds.includes("DRAFT")) {
          // No inbox/sent/draft label = archived
          folder = "archive";
        }

        // Match to contact
        const matchEmail = direction === "inbound" ? fromEmail : toEmails[0];
        const contactId = emailToContactId[matchEmail?.toLowerCase() || ""] || null;

        // Extract HTML body from message payload
        const bodyHtml = getEmailBodyHtml(msgData.payload);

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
            body_html: bodyHtml,
            from_email: fromEmail,
            from_name: fromName,
            to_emails: toEmails,
            received_at: date ? new Date(date).toISOString() : new Date().toISOString(),
            is_read: !labelIds.includes("UNREAD"),
            direction,
            labels: labelIds,
            folder,
          })
          .select()
          .single();

        if (!insertError && inserted) {
          syncedEmails.push(inserted);
        } else if (insertError) {
          console.error(`Error inserting email ${msg.id}:`, insertError);
          errorCount++;
        }
      } catch (err) {
        console.error(`Error syncing message ${msg.id}:`, err);
        errorCount++;
      }
    }

    console.log(`Sync complete: ${syncedEmails.length} new, ${skippedCount} skipped (already synced), ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount: syncedEmails.length,
        skippedCount,
        errorCount,
        totalFound: allMessageIds.length,
        emails: syncedEmails.slice(0, 50), // Only return first 50 in response to reduce payload
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
