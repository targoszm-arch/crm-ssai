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
    const { eventId, accountId, googleEventId, updates, delete: deleteEvent } = await req.json();

    if (!accountId) {
      return new Response(JSON.stringify({ error: "Account ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get account with tokens
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
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

    // Get the event to find the Google event ID
    let targetGoogleEventId = googleEventId;
    if (eventId && !targetGoogleEventId) {
      const { data: event } = await supabase
        .from("calendar_events")
        .select("google_event_id")
        .eq("id", eventId)
        .single();
      targetGoogleEventId = event?.google_event_id;
    }

    if (!targetGoogleEventId) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (deleteEvent) {
      // Delete event from Google Calendar
      console.log("Deleting Google Calendar event:", targetGoogleEventId);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${targetGoogleEventId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok && response.status !== 404) {
        const errorText = await response.text();
        console.error("Google Calendar API error:", errorText);
        return new Response(JSON.stringify({ error: "Failed to delete event" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete from database
      await supabase.from("calendar_events").delete().eq("id", eventId);

      return new Response(
        JSON.stringify({ success: true, deleted: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update event in Google Calendar
    const googleUpdates: Record<string, unknown> = {};

    if (updates.title) googleUpdates.summary = updates.title;
    if (updates.description !== undefined) googleUpdates.description = updates.description;
    if (updates.location !== undefined) googleUpdates.location = updates.location;
    if (updates.startTime) {
      googleUpdates.start = updates.allDay
        ? { date: updates.startTime.split("T")[0] }
        : { dateTime: updates.startTime, timeZone: "UTC" };
    }
    if (updates.endTime) {
      googleUpdates.end = updates.allDay
        ? { date: updates.endTime.split("T")[0] }
        : { dateTime: updates.endTime, timeZone: "UTC" };
    }
    if (updates.attendees) {
      googleUpdates.attendees = updates.attendees.map((email: string) => ({ email }));
    }

    console.log("Updating Google Calendar event:", targetGoogleEventId, googleUpdates);

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${targetGoogleEventId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(googleUpdates),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Calendar API error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to update event" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updatedGoogleEvent = await response.json();

    // Update in database
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.startTime) dbUpdates.start_time = updates.startTime;
    if (updates.endTime) dbUpdates.end_time = updates.endTime;
    if (updates.allDay !== undefined) dbUpdates.all_day = updates.allDay;
    if (updates.attendees) dbUpdates.attendees = updates.attendees;

    const { data: savedEvent, error: saveError } = await supabase
      .from("calendar_events")
      .update(dbUpdates)
      .eq("id", eventId)
      .select()
      .single();

    if (saveError) {
      console.error("Error updating event in database:", saveError);
    }

    return new Response(
      JSON.stringify({ success: true, event: savedEvent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Update calendar event error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
