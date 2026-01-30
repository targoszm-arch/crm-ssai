import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-extension-key",
};

interface LinkedInMessage {
  id?: string;
  sender_linkedin_id?: string;
  sender_name?: string;
  sender_profile_url?: string;
  recipient_linkedin_id?: string;
  message_text?: string;
  message?: string;
  text?: string;
  content?: string;
  timestamp?: string;
  message_timestamp?: string;
  created_at?: string;
  conversation_url?: string;
  linkedin_conversation_url?: string;
  company_name?: string;
  is_outbound?: boolean;
  direction?: string;
}

interface LinkedInConnection {
  linkedin_id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  company?: string;
  profile_url?: string;
  linkedin_profile_url?: string;
  connected_at?: string;
}

interface WebhookPayload {
  type?: string;
  event_type?: string;
  action?: string;
  messages?: LinkedInMessage[];
  connections?: LinkedInConnection[];
  data?: any;
  user_linkedin_id?: string;
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

    // Validate API key from extension
    const apiKey = req.headers.get("x-api-key") || req.headers.get("x-extension-key");
    const expectedKey = Deno.env.get("LINKEDIN_GUARD_API_KEY");
    
    if (!expectedKey) {
      console.error("LINKEDIN_GUARD_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!apiKey || apiKey !== expectedKey) {
      console.error("Invalid or missing API key");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: WebhookPayload = await req.json();
    console.log("LinkedIn Guard webhook received:", JSON.stringify(body, null, 2));

    const results = {
      messages: { found: 0, synced: 0, errors: [] as string[] },
      connections: { found: 0, synced: 0, errors: [] as string[] },
    };

    // Handle messages
    const messages = body.messages || (body.data?.messages) || [];
    if (messages.length > 0) {
      results.messages.found = messages.length;
      console.log(`Processing ${messages.length} messages`);

      for (const msg of messages) {
        try {
          // Extract message text from various possible field names
          const messageText = 
            msg.message_text || 
            msg.message || 
            msg.text || 
            msg.content || 
            "";

          if (!messageText) {
            console.log("Skipping message with no text content");
            continue;
          }

          // Extract sender LinkedIn ID
          const senderLinkedInId = 
            msg.sender_linkedin_id || 
            extractLinkedInId(msg.sender_profile_url) ||
            "unknown";

          // Extract recipient LinkedIn ID  
          const recipientLinkedInId = 
            msg.recipient_linkedin_id || 
            body.user_linkedin_id ||
            "unknown";

          // Extract timestamp
          const messageTimestamp = 
            msg.timestamp || 
            msg.message_timestamp || 
            msg.created_at || 
            new Date().toISOString();

          // Try to find connection by profile URL
          let connectionId: string | undefined;
          const profileUrl = msg.sender_profile_url || msg.conversation_url;
          if (profileUrl) {
            const linkedinId = extractLinkedInId(profileUrl);
            if (linkedinId) {
              const { data: connection } = await supabase
                .from("linkedin_connections")
                .select("id")
                .eq("linkedin_id", linkedinId)
                .single();
              connectionId = connection?.id;
            }
          }

          // Upsert the message
          const { error } = await supabase
            .from("linkedin_messages")
            .upsert(
              {
                sender_linkedin_id: senderLinkedInId,
                recipient_linkedin_id: recipientLinkedInId,
                sender_name: msg.sender_name,
                message_text: messageText,
                message_timestamp: messageTimestamp,
                linkedin_conversation_url: msg.conversation_url || msg.linkedin_conversation_url,
                company_name: msg.company_name,
                connection_id: connectionId,
                is_read: false,
                raw_payload: msg,
              },
              {
                onConflict: "sender_linkedin_id,message_timestamp",
                ignoreDuplicates: true,
              }
            );

          if (error) {
            // If constraint doesn't exist, try regular insert
            if (error.code === "42P10" || error.code === "23505") {
              console.log("Message already exists or constraint issue, skipping");
            } else {
              console.error("Message upsert error:", error);
              results.messages.errors.push(error.message);
            }
          } else {
            results.messages.synced++;
          }
        } catch (e) {
          console.error("Error processing message:", e);
          results.messages.errors.push(String(e));
        }
      }
    }

    // Handle connections
    const connections = body.connections || (body.data?.connections) || [];
    if (connections.length > 0) {
      results.connections.found = connections.length;
      console.log(`Processing ${connections.length} connections`);

      for (const conn of connections) {
        try {
          const profileUrl = conn.profile_url || conn.linkedin_profile_url;
          const linkedinId = conn.linkedin_id || extractLinkedInId(profileUrl);
          
          if (!linkedinId) {
            console.log("Skipping connection - no LinkedIn ID");
            continue;
          }

          const connectionName = 
            conn.name || 
            `${conn.first_name || ""} ${conn.last_name || ""}`.trim() ||
            "Unknown";

          const { error } = await supabase
            .from("linkedin_connections")
            .upsert(
              {
                linkedin_id: linkedinId,
                name: connectionName,
                headline: conn.headline,
                company: conn.company,
                profile_url: profileUrl,
                connection_status: "Connected",
                synced_at: new Date().toISOString(),
              },
              { onConflict: "linkedin_id" }
            );

          if (error) {
            console.error("Connection upsert error:", error);
            results.connections.errors.push(error.message);
          } else {
            results.connections.synced++;
          }
        } catch (e) {
          console.error("Error processing connection:", e);
          results.connections.errors.push(String(e));
        }
      }
    }

    console.log("Webhook processing complete:", results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("LinkedIn Guard webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function extractLinkedInId(profileUrl: string | undefined): string | null {
  if (!profileUrl) return null;
  
  // Extract LinkedIn ID from various URL formats
  // https://www.linkedin.com/in/username/
  // https://linkedin.com/in/username
  const match = profileUrl.match(/linkedin\.com\/in\/([^\/\?]+)/i);
  if (match) return match[1];
  
  // Try extracting from conversation URL
  const convMatch = profileUrl.match(/\/messaging\/thread\/([^\/\?]+)/i);
  if (convMatch) return convMatch[1];
  
  return null;
}
