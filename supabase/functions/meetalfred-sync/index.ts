import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MeetAlfredPerson {
  linkedin_profile_url?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  headline?: string;
  company?: string;
  location?: string;
  profile_picture_url?: string;
}

interface MeetAlfredCampaign {
  id: number;
  name: string;
  type?: string;
}

interface MeetAlfredReply {
  id: number;
  reply_detected_on: string;
  message?: string;
  person: MeetAlfredPerson;
  campaign: MeetAlfredCampaign;
}

interface MeetAlfredConnection {
  id: number;
  connected_on?: string;
  person: MeetAlfredPerson;
  campaign?: MeetAlfredCampaign;
}

interface MeetAlfredLead {
  id: number;
  added_on?: string;
  person: MeetAlfredPerson;
  campaign: MeetAlfredCampaign;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const webhookKey = Deno.env.get("MEETALFRED_WEBHOOK_KEY");
    if (!webhookKey) {
      throw new Error("MEETALFRED_WEBHOOK_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const syncType = url.searchParams.get("type") || "all";
    const page = url.searchParams.get("page") || "0";
    const perPage = url.searchParams.get("per_page") || "100";

    const results = {
      replies: { synced: 0, errors: [] as string[] },
      connections: { synced: 0, errors: [] as string[] },
      leads: { synced: 0, errors: [] as string[] },
    };

    // Sync Replies
    if (syncType === "all" || syncType === "replies") {
      try {
        const repliesUrl = `https://meetalfred.com/api/integrations/webhook/new-reply-detected?webhook_key=${webhookKey}&page=${page}&per_page=${perPage}`;
        console.log("Fetching replies from Meet Alfred...");
        
        const repliesRes = await fetch(repliesUrl);
        if (!repliesRes.ok) {
          throw new Error(`Meet Alfred API error: ${repliesRes.status}`);
        }
        
        const repliesData = await repliesRes.json();
        const replies: MeetAlfredReply[] = repliesData.actions || [];
        
        console.log(`Found ${replies.length} replies`);

        for (const reply of replies) {
          try {
            const linkedinId = extractLinkedInId(reply.person?.linkedin_profile_url);
            if (!linkedinId) continue;

            // Find or create linkedin connection
            let { data: connection } = await supabase
              .from("linkedin_connections")
              .select("id")
              .eq("linkedin_id", linkedinId)
              .single();

            if (!connection) {
              const { data: newConn } = await supabase
                .from("linkedin_connections")
                .insert({
                  linkedin_id: linkedinId,
                  name: `${reply.person?.first_name || ""} ${reply.person?.last_name || ""}`.trim() || "Unknown",
                  headline: reply.person?.headline,
                  company: reply.person?.company,
                  profile_url: reply.person?.linkedin_profile_url,
                  connection_status: "Connected",
                })
                .select("id")
                .single();
              connection = newConn;
            }

            // Insert reply as linkedin message
            if (connection) {
              await supabase.from("linkedin_messages").upsert(
                {
                  sender_linkedin_id: linkedinId,
                  recipient_linkedin_id: "me",
                  message_text: reply.message || `Reply from ${reply.campaign?.name || "campaign"}`,
                  message_timestamp: reply.reply_detected_on || new Date().toISOString(),
                  connection_id: connection.id,
                  is_read: false,
                },
                { onConflict: "sender_linkedin_id,message_timestamp" }
              );
              results.replies.synced++;
            }
          } catch (e) {
            results.replies.errors.push(String(e));
          }
        }
      } catch (e) {
        console.error("Error syncing replies:", e);
        results.replies.errors.push(String(e));
      }
    }

    // Sync Connections
    if (syncType === "all" || syncType === "connections") {
      try {
        const connectionsUrl = `https://meetalfred.com/api/integrations/webhook/new-connections?webhook_key=${webhookKey}&return_only_synced=true&page=${page}&per_page=${perPage}`;
        console.log("Fetching connections from Meet Alfred...");
        
        const connectionsRes = await fetch(connectionsUrl);
        if (!connectionsRes.ok) {
          throw new Error(`Meet Alfred API error: ${connectionsRes.status}`);
        }
        
        const connectionsData = await connectionsRes.json();
        const connections: MeetAlfredConnection[] = connectionsData.actions || [];
        
        console.log(`Found ${connections.length} connections`);

        for (const conn of connections) {
          try {
            const linkedinId = extractLinkedInId(conn.person?.linkedin_profile_url);
            if (!linkedinId) continue;

            // Try to find matching contact by linkedin URL
            const { data: existingContact } = await supabase
              .from("contacts")
              .select("id")
              .eq("linkedin_url", conn.person?.linkedin_profile_url)
              .single();

            await supabase.from("linkedin_connections").upsert(
              {
                linkedin_id: linkedinId,
                name: `${conn.person?.first_name || ""} ${conn.person?.last_name || ""}`.trim() || "Unknown",
                headline: conn.person?.headline,
                company: conn.person?.company,
                profile_url: conn.person?.linkedin_profile_url,
                connection_status: "Connected",
                synced_at: new Date().toISOString(),
                contact_id: existingContact?.id || null,
              },
              { onConflict: "linkedin_id" }
            );
            results.connections.synced++;
          } catch (e) {
            results.connections.errors.push(String(e));
          }
        }
      } catch (e) {
        console.error("Error syncing connections:", e);
        results.connections.errors.push(String(e));
      }
    }

    // Sync Leads
    if (syncType === "all" || syncType === "leads") {
      try {
        const leadsUrl = `https://meetalfred.com/api/integrations/webhook/new-leads?webhook_key=${webhookKey}&page=${page}&per_page=${perPage}`;
        console.log("Fetching leads from Meet Alfred...");
        
        const leadsRes = await fetch(leadsUrl);
        if (!leadsRes.ok) {
          throw new Error(`Meet Alfred API error: ${leadsRes.status}`);
        }
        
        const leadsData = await leadsRes.json();
        const leads: MeetAlfredLead[] = leadsData.actions || [];
        
        console.log(`Found ${leads.length} leads`);

        for (const lead of leads) {
          try {
            // Try to find existing contact by email or linkedin URL
            let contactId: string | null = null;
            
            if (lead.person?.email) {
              const { data: emailContact } = await supabase
                .from("contacts")
                .select("id")
                .eq("email", lead.person.email)
                .single();
              contactId = emailContact?.id || null;
            }
            
            if (!contactId && lead.person?.linkedin_profile_url) {
              const { data: linkedinContact } = await supabase
                .from("contacts")
                .select("id")
                .eq("linkedin_url", lead.person.linkedin_profile_url)
                .single();
              contactId = linkedinContact?.id || null;
            }

            // Create lead record
            await supabase.from("leads").upsert(
              {
                contact_id: contactId,
                contact_name: `${lead.person?.first_name || ""} ${lead.person?.last_name || ""}`.trim() || null,
                company_name: lead.person?.company || null,
                email: lead.person?.email || null,
                source: `Meet Alfred - ${lead.campaign?.name || "Campaign"}`,
                status: "New",
                notes: lead.person?.headline ? `Headline: ${lead.person.headline}` : null,
              },
              { onConflict: "email", ignoreDuplicates: true }
            );
            results.leads.synced++;
          } catch (e) {
            results.leads.errors.push(String(e));
          }
        }
      } catch (e) {
        console.error("Error syncing leads:", e);
        results.leads.errors.push(String(e));
      }
    }

    console.log("Sync complete:", results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Meet Alfred sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractLinkedInId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  return match ? match[1] : url;
}
