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
  isTracked?: boolean;
}

// Inject tracking pixel into HTML body
function injectTrackingPixel(html: string, emailId: string, supabaseUrl: string): string {
  const trackingPixel = `<img src="${supabaseUrl}/functions/v1/track-email-open?eid=${emailId}" width="1" height="1" style="display:none;" alt="" />`;
  
  // Try to inject before </body> if it exists
  if (html.toLowerCase().includes("</body>")) {
    return html.replace(/<\/body>/i, `${trackingPixel}</body>`);
  }
  
  // Otherwise append at the end
  return html + trackingPixel;
}

// Wrap links for click tracking
function wrapLinksForTracking(html: string, emailId: string, supabaseUrl: string): string {
  // Match href attributes with http/https URLs
  const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
  
  return html.replace(linkRegex, (match, url) => {
    // Don't wrap tracking URLs or unsubscribe links
    if (url.includes("/functions/v1/track-") || url.includes("unsubscribe")) {
      return match;
    }
    
    const encodedUrl = encodeURIComponent(url);
    const trackingUrl = `${supabaseUrl}/functions/v1/track-email-click?eid=${emailId}&url=${encodedUrl}`;
    return `href="${trackingUrl}"`;
  });
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

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

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

    const { accountId, to, subject, body, contactId, isTracked = false }: SendEmailRequest = await req.json();

    if (!accountId || !to || to.length === 0 || !subject || !body) {
      throw new Error("accountId, to, subject, and body are required");
    }

    console.log(`Sending email from account: ${accountId}, tracked: ${isTracked}`);

    // Verify account belongs to user
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", user.id)
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

    // First, store the email to get an ID for tracking
    const { data: storedEmail, error: storeError } = await supabase
      .from("emails")
      .insert({
        account_id: accountId,
        gmail_id: `pending-${Date.now()}`, // Temporary ID until we get the real one
        thread_id: null,
        contact_id: contactId || null,
        subject,
        snippet: body.substring(0, 200).replace(/<[^>]*>/g, ''), // Strip HTML for snippet
        from_email: account.email_address,
        from_name: account.email_address.split("@")[0],
        to_emails: to,
        received_at: new Date().toISOString(),
        is_read: true,
        direction: "outbound",
        labels: ["SENT"],
        folder: "sent",
        is_tracked: isTracked,
        open_count: 0,
        click_count: 0,
      })
      .select()
      .single();

    if (storeError) {
      console.error("Error storing email before send:", storeError);
      throw new Error("Failed to prepare email for sending");
    }

    // Apply tracking if enabled
    let finalBody = body;
    if (isTracked && storedEmail) {
      console.log(`Injecting tracking for email ${storedEmail.id}`);
      finalBody = wrapLinksForTracking(finalBody, storedEmail.id, supabaseUrl);
      finalBody = injectTrackingPixel(finalBody, storedEmail.id, supabaseUrl);
    }

    // Store the final body with tracking
    if (isTracked && storedEmail) {
      await supabase
        .from("emails")
        .update({ body_html: finalBody })
        .eq("id", storedEmail.id);
    }

    // Create email in RFC 2822 format
    const emailLines = [
      `To: ${to.join(", ")}`,
      `From: ${account.email_address}`,
      `Subject: ${subject}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      finalBody,
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
      
      // Clean up the pending email record on failure
      if (storedEmail) {
        await supabase.from("emails").delete().eq("id", storedEmail.id);
      }
      
      throw new Error(`Failed to send email: ${sendResponse.status}`);
    }

    const sentMessage = await sendResponse.json();
    console.log(`Email sent successfully: ${sentMessage.id}`);

    // Update the stored email with the real Gmail ID
    const { error: updateError } = await supabase
      .from("emails")
      .update({
        gmail_id: sentMessage.id,
        thread_id: sentMessage.threadId,
      })
      .eq("id", storedEmail.id);

    if (updateError) {
      console.error("Error updating email with Gmail ID:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: sentMessage.id,
        email: { ...storedEmail, gmail_id: sentMessage.id, thread_id: sentMessage.threadId },
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
