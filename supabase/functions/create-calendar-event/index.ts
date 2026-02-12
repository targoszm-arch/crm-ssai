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

    const {
      accountId,
      title,
      description,
      location,
      startTime,
      endTime,
      allDay,
      attendees,
      contactId,
      companyId,
    } = await req.json();

    if (!accountId || !title || !startTime || !endTime) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: accountId, title, startTime, endTime" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Create event in Google Calendar
    const googleEvent = {
      summary: title,
      description: description || undefined,
      location: location || undefined,
      start: allDay
        ? { date: startTime.split("T")[0] }
        : { dateTime: startTime, timeZone: "UTC" },
      end: allDay
        ? { date: endTime.split("T")[0] }
        : { dateTime: endTime, timeZone: "UTC" },
      attendees: attendees?.map((email: string) => ({ email })) || [],
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    console.log("Creating Google Calendar event:", googleEvent);

    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(googleEvent),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Calendar API error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to create event" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const createdEvent = await response.json();
    console.log("Created Google Calendar event:", createdEvent.id);

    // Store event in database
    const eventRecord = {
      account_id: accountId,
      google_event_id: createdEvent.id,
      title,
      description: description || null,
      location: location || null,
      start_time: startTime,
      end_time: endTime,
      all_day: allDay || false,
      attendees: attendees || [],
      meeting_link: createdEvent.hangoutLink || null,
      status: "confirmed",
      contact_id: contactId || null,
      company_id: companyId || null,
    };

    const { data: savedEvent, error: saveError } = await supabase
      .from("calendar_events")
      .insert(eventRecord)
      .select()
      .single();

    if (saveError) {
      console.error("Error saving event to database:", saveError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        event: savedEvent,
        googleEventId: createdEvent.id,
        meetingLink: createdEvent.hangoutLink,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create calendar event error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
