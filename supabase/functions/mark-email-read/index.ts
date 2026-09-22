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

    // Reading a conversation means reading every synced reply in it. Manual
    // "mark unread" remains message-specific so users can flag one reply.
    let emailsToUpdate = [email];
    if (isRead && email.thread_id) {
      const { data: threadEmails, error: threadError } = await supabase
        .from("emails")
        .select("id, gmail_id, labels")
        .eq("account_id", email.account_id)
        .eq("thread_id", email.thread_id)
        .eq("is_read", false);

      if (threadError) throw new Error(`Failed to load email thread: ${threadError.message}`);
      if (threadEmails?.length) emailsToUpdate = threadEmails;
    }

    // Try Gmail for every reply, but a failure there (wrong scope, token
    // hiccup, Gmail outage) must never block the local read state -- that
    // used to throw before the database update ran at all, so the CRM's own
    // unread badge stayed wrong for a reason that had nothing to do with the
    // CRM. Best-effort against Gmail, unconditional against the local table.
    const modifyBody = isRead
      ? { removeLabelIds: ["UNREAD"] }
      : { addLabelIds: ["UNREAD"] };

    const updatedLabels = new Map<string, string[]>();
    let gmailSyncFailed = false;
    for (const threadEmail of emailsToUpdate) {
      try {
        const gmailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${threadEmail.gmail_id}/modify`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(modifyBody),
          }
        );
        if (!gmailResponse.ok) {
          const errorText = await gmailResponse.text();
          console.error(`Gmail API error for ${threadEmail.id}:`, errorText);
          gmailSyncFailed = true;
          continue;
        }
        const gmailResult = await gmailResponse.json();
        updatedLabels.set(threadEmail.id, gmailResult.labelIds || threadEmail.labels || []);
      } catch (gmailError) {
        console.error(`Gmail request failed for ${threadEmail.id}:`, gmailError);
        gmailSyncFailed = true;
      }
    }

    // Update local database regardless of Gmail's outcome. Only overwrite
    // `labels` where Gmail actually confirmed the new set -- otherwise leave
    // the stored labels alone rather than guessing.
    for (const threadEmail of emailsToUpdate) {
      const patch: { is_read: boolean; labels?: string[] } = { is_read: isRead };
      const confirmedLabels = updatedLabels.get(threadEmail.id);
      if (confirmedLabels) patch.labels = confirmedLabels;
      const { error: updateError } = await supabase
        .from("emails")
        .update(patch)
        .eq("id", threadEmail.id);
      if (updateError) throw new Error(`Failed to update local database: ${updateError.message}`);
    }

    console.log(`Successfully marked email ${emailId} as ${isRead ? 'read' : 'unread'} locally${gmailSyncFailed ? " (Gmail sync failed for one or more messages)" : ""}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailId,
        isRead,
        updatedCount: emailsToUpdate.length,
        gmailSyncFailed,
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
