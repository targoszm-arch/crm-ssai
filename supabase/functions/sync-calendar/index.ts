import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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

    const { accountId } = await req.json();

    if (!accountId) {
      return new Response(JSON.stringify({ error: "Account ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify account belongs to user
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      console.error("Account not found:", accountError);
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Refresh token if expired
    let accessToken = account.access_token;
    if (account.expires_at && new Date(account.expires_at) < new Date()) {
      console.log("Token expired, refreshing...");
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: account.refresh_token!,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshResponse.json();
      if (refreshData.access_token) {
        accessToken = refreshData.access_token;
        await supabase
          .from("email_accounts")
          .update({
            access_token: refreshData.access_token,
            expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          })
          .eq("id", accountId);
      }
    }

    // Fetch calendar events from Google Calendar API
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString();

    console.log(`Fetching calendar events from ${timeMin} to ${timeMax}`);

    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "250",
        }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error("Calendar API error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to fetch calendar events" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const calendarData = await calendarResponse.json();
    const events = calendarData.items || [];
    console.log(`Fetched ${events.length} calendar events`);

    // Get all contacts for matching
    const { data: contacts } = await supabase.from("contacts").select("id, email");
    const contactEmailMap = new Map(
      (contacts || []).filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c.id])
    );

    // Process and upsert events
    let syncedCount = 0;
    for (const event of events) {
      if (!event.id) continue;

      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;
      const isAllDay = !event.start?.dateTime;

      // Extract attendees
      const attendeeEmails = (event.attendees || []).map((a: { email: string }) => a.email);

      // Find matching contact
      let contactId = null;
      for (const email of attendeeEmails) {
        const foundId = contactEmailMap.get(email.toLowerCase());
        if (foundId) {
          contactId = foundId;
          break;
        }
      }

      // Extract meeting link
      let meetingLink = event.hangoutLink || null;
      if (!meetingLink && event.conferenceData?.entryPoints) {
        const videoEntry = event.conferenceData.entryPoints.find(
          (e: { entryPointType: string }) => e.entryPointType === "video"
        );
        if (videoEntry) meetingLink = videoEntry.uri;
      }

      const eventRecord = {
        account_id: accountId,
        google_event_id: event.id,
        title: event.summary || "No Title",
        description: event.description || null,
        location: event.location || null,
        start_time: startTime,
        end_time: endTime,
        all_day: isAllDay,
        attendees: attendeeEmails,
        meeting_link: meetingLink,
        status: event.status || "confirmed",
        contact_id: contactId,
      };

      const { error: upsertError } = await supabase.from("calendar_events").upsert(eventRecord, {
        onConflict: "account_id,google_event_id",
      });

      if (upsertError) {
        console.error("Error upserting event:", upsertError);
      } else {
        syncedCount++;
      }
    }

    console.log(`Successfully synced ${syncedCount} calendar events`);

    return new Response(
      JSON.stringify({ success: true, syncedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync calendar error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
