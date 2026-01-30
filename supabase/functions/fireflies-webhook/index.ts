import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature",
};

interface FirefliesWebhookPayload {
  meetingId: string;
  eventType: string;
  clientReferenceId?: string;
}

interface FirefliesTranscript {
  id: string;
  title: string;
  date: string;
  duration: number;
  participants: string[];
  transcript_url: string;
  audio_url: string;
  summary: {
    overview: string;
    shorthand_bullet: string;
    action_items: string;
    gist: string;
    meeting_type: string;
  };
}

async function fetchTranscriptFromFireflies(
  transcriptId: string,
  apiKey: string
): Promise<FirefliesTranscript | null> {
  const query = `
    query Transcript($transcriptId: String!) {
      transcript(id: $transcriptId) {
        id
        title
        date
        duration
        participants
        transcript_url
        audio_url
        summary {
          overview
          shorthand_bullet
          action_items
          gist
          meeting_type
        }
      }
    }
  `;

  console.log(`Fetching transcript ${transcriptId} from Fireflies API`);

  const response = await fetch("https://api.fireflies.ai/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      variables: { transcriptId },
    }),
  });

  if (!response.ok) {
    console.error(`Fireflies API error: ${response.status} ${response.statusText}`);
    return null;
  }

  const result = await response.json();

  if (result.errors) {
    console.error("Fireflies GraphQL errors:", result.errors);
    return null;
  }

  return result.data?.transcript || null;
}

function extractEmailsFromParticipants(participants: string[]): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails: string[] = [];

  for (const participant of participants) {
    const matches = participant.match(emailRegex);
    if (matches) {
      emails.push(...matches.map((e) => e.toLowerCase()));
    }
  }

  return [...new Set(emails)]; // Remove duplicates
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const FIREFLIES_API_KEY = Deno.env.get("FIREFLIES_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!FIREFLIES_API_KEY) {
      console.error("FIREFLIES_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "FIREFLIES_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase credentials not configured");
      return new Response(
        JSON.stringify({ error: "Supabase not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse webhook payload
    const payload: FirefliesWebhookPayload = await req.json();
    console.log("Received Fireflies webhook:", JSON.stringify(payload));

    const { meetingId, eventType } = payload;

    // Only process transcription completed events
    if (eventType !== "Transcription completed") {
      console.log(`Ignoring event type: ${eventType}`);
      return new Response(
        JSON.stringify({ message: `Event type ${eventType} ignored` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!meetingId) {
      console.error("No meetingId in webhook payload");
      return new Response(
        JSON.stringify({ error: "No meetingId provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if we already have this meeting
    const { data: existing } = await supabase
      .from("meeting_notes")
      .select("id")
      .eq("fireflies_meeting_id", meetingId)
      .single();

    if (existing) {
      console.log(`Meeting ${meetingId} already exists, skipping`);
      return new Response(
        JSON.stringify({ message: "Meeting already processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch full transcript from Fireflies
    const transcript = await fetchTranscriptFromFireflies(meetingId, FIREFLIES_API_KEY);

    if (!transcript) {
      console.error(`Failed to fetch transcript for meeting ${meetingId}`);
      return new Response(
        JSON.stringify({ error: "Failed to fetch transcript" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetched transcript: ${transcript.title}`);

    // Extract emails from participants
    const participantEmails = extractEmailsFromParticipants(transcript.participants);
    console.log(`Found participant emails: ${participantEmails.join(", ")}`);

    // Find matching contacts
    let matchedContactIds: string[] = [];
    if (participantEmails.length > 0) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, email")
        .in("email", participantEmails);

      if (contacts && contacts.length > 0) {
        matchedContactIds = contacts.map((c) => c.id);
        console.log(`Matched ${contacts.length} contacts`);
      }
    }

    // Parse action items if they're a string
    let actionItems = [];
    if (transcript.summary?.action_items) {
      try {
        if (typeof transcript.summary.action_items === "string") {
          // Try to parse as JSON, otherwise split by newlines
          try {
            actionItems = JSON.parse(transcript.summary.action_items);
          } catch {
            actionItems = transcript.summary.action_items
              .split("\n")
              .filter((item: string) => item.trim())
              .map((item: string) => ({ text: item.trim() }));
          }
        } else {
          actionItems = transcript.summary.action_items;
        }
      } catch (e) {
        console.log("Could not parse action items:", e);
      }
    }

    // Create meeting notes for each matched contact (or one without contact if no matches)
    const meetingNoteBase = {
      fireflies_meeting_id: transcript.id,
      title: transcript.title,
      meeting_date: transcript.date,
      duration_minutes: transcript.duration,
      participants: transcript.participants,
      overview: transcript.summary?.overview || null,
      action_items: actionItems,
      summary: transcript.summary?.gist || null,
      bullet_gist: transcript.summary?.shorthand_bullet || null,
      transcript_url: transcript.transcript_url || null,
      audio_url: transcript.audio_url || null,
      meeting_type: transcript.summary?.meeting_type || null,
      raw_data: transcript,
    };

    if (matchedContactIds.length > 0) {
      // Create a note for each matched contact
      for (const contactId of matchedContactIds) {
        const { error } = await supabase.from("meeting_notes").insert({
          ...meetingNoteBase,
          contact_id: contactId,
        });

        if (error) {
          console.error(`Error inserting meeting note for contact ${contactId}:`, error);
        } else {
          console.log(`Created meeting note for contact ${contactId}`);
        }
      }
    } else {
      // Create a note without contact association
      const { error } = await supabase.from("meeting_notes").insert(meetingNoteBase);

      if (error) {
        console.error("Error inserting meeting note:", error);
      } else {
        console.log("Created meeting note without contact association");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed meeting ${transcript.title}`,
        matchedContacts: matchedContactIds.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
