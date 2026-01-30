import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-extension-key",
};

interface LinkedInMessage {
  sender_linkedin_id: string;
  recipient_linkedin_id: string;
  message_text: string;
  message_timestamp: string;
  connection_id?: string;
}

interface SyncRequest {
  messages: LinkedInMessage[];
  user_linkedin_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get extension key from header for basic auth (you can set this in secrets)
    const extensionKey = req.headers.get("x-extension-key");
    const expectedKey = Deno.env.get("LINKEDIN_EXTENSION_KEY");
    
    // If an extension key is configured, validate it
    if (expectedKey && extensionKey !== expectedKey) {
      console.error("Invalid extension key");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SyncRequest = await req.json();
    console.log(`Syncing ${body.messages?.length || 0} LinkedIn messages`);

    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(
        JSON.stringify({ error: "messages array required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let syncedCount = 0;
    let skippedCount = 0;

    for (const msg of body.messages) {
      // Check for required fields
      if (!msg.sender_linkedin_id || !msg.recipient_linkedin_id || !msg.message_text) {
        console.log("Skipping message with missing required fields");
        skippedCount++;
        continue;
      }

      // Try to find the connection by LinkedIn ID
      let connectionId = msg.connection_id;
      if (!connectionId) {
        const otherLinkedInId = msg.sender_linkedin_id === body.user_linkedin_id 
          ? msg.recipient_linkedin_id 
          : msg.sender_linkedin_id;
          
        const { data: connection } = await supabase
          .from("linkedin_connections")
          .select("id")
          .eq("linkedin_id", otherLinkedInId)
          .single();
          
        connectionId = connection?.id;
      }

      // Upsert the message (using a composite check on sender, recipient, timestamp)
      const { error } = await supabase
        .from("linkedin_messages")
        .upsert(
          {
            sender_linkedin_id: msg.sender_linkedin_id,
            recipient_linkedin_id: msg.recipient_linkedin_id,
            message_text: msg.message_text,
            message_timestamp: msg.message_timestamp || new Date().toISOString(),
            connection_id: connectionId,
            is_read: false,
          },
          {
            onConflict: "sender_linkedin_id,recipient_linkedin_id,message_timestamp",
            ignoreDuplicates: true,
          }
        );

      if (error) {
        // If unique constraint doesn't exist, just insert
        if (error.code === "42P10") {
          const { error: insertError } = await supabase
            .from("linkedin_messages")
            .insert({
              sender_linkedin_id: msg.sender_linkedin_id,
              recipient_linkedin_id: msg.recipient_linkedin_id,
              message_text: msg.message_text,
              message_timestamp: msg.message_timestamp || new Date().toISOString(),
              connection_id: connectionId,
              is_read: false,
            });
          
          if (insertError) {
            console.error("Insert error:", insertError);
            skippedCount++;
          } else {
            syncedCount++;
          }
        } else {
          console.error("Upsert error:", error);
          skippedCount++;
        }
      } else {
        syncedCount++;
      }
    }

    console.log(`Synced ${syncedCount} messages, skipped ${skippedCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        syncedCount, 
        skippedCount,
        totalReceived: body.messages.length 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("LinkedIn sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
