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
      replies: { found: 0, synced: 0, errors: [] as string[] },
      connections: { found: 0, synced: 0, errors: [] as string[] },
      leads: { found: 0, synced: 0, errors: [] as string[] },
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
        results.replies.found = replies.length;
        
        console.log(`Found ${replies.length} replies`);
        
        // Log first reply structure for debugging
        if (replies.length > 0) {
          console.log("Sample reply structure:", JSON.stringify(replies[0], null, 2));
        }

        for (const reply of replies) {
          try {
            // Extract LinkedIn ID if available, otherwise use fallback
            const linkedinId = extractLinkedInId(reply.person?.linkedin_profile_url);
            const personName = `${reply.person?.first_name || ""} ${reply.person?.last_name || ""}`.trim() || "Unknown";
            
            // Generate a unique sender ID - use LinkedIn ID if available, otherwise use reply ID
            const senderId = linkedinId || `meetalfred_reply_${reply.id}`;
            const messageTimestamp = reply.reply_detected_on || new Date().toISOString();
            
            console.log(`Processing reply ${reply.id} from ${personName}, senderId: ${senderId}`);

            let connectionId: string | null = null;

            // Only try to create/find connection if we have a LinkedIn ID
            if (linkedinId) {
              const { data: connection, error: connError } = await supabase
                .from("linkedin_connections")
                .upsert(
                  {
                    linkedin_id: linkedinId,
                    name: personName,
                    headline: reply.person?.headline,
                    company: reply.person?.company,
                    profile_url: reply.person?.linkedin_profile_url,
                    connection_status: "Connected",
                    synced_at: new Date().toISOString(),
                  },
                  { onConflict: "linkedin_id" }
                )
                .select("id")
                .single();

              if (connError) {
                console.error("Connection upsert error:", connError);
              } else if (connection) {
                connectionId = connection.id;
              }
            }

            // Always insert the reply message, even without LinkedIn ID
            const { error: msgError } = await supabase.from("linkedin_messages").upsert(
              {
                sender_linkedin_id: senderId,
                recipient_linkedin_id: "me",
                message_text: reply.message || `Reply from ${reply.campaign?.name || "campaign"} - ${personName}`,
                message_timestamp: messageTimestamp,
                connection_id: connectionId,
                is_read: false,
              },
              { onConflict: "sender_linkedin_id,message_timestamp" }
            );
            
            if (msgError) {
              console.error("Message upsert error:", msgError);
              results.replies.errors.push(`Message upsert: ${msgError.message}`);
            } else {
              results.replies.synced++;
              console.log(`Synced reply from ${personName}`);
            }
          } catch (e) {
            console.error("Error processing reply:", e);
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
        results.connections.found = connections.length;
        
        console.log(`Found ${connections.length} connections`);

        for (const conn of connections) {
          try {
            const linkedinId = extractLinkedInId(conn.person?.linkedin_profile_url);
            if (!linkedinId) {
              console.log("Skipping connection - no LinkedIn ID found");
              continue;
            }

            // Try to find matching contact by linkedin URL
            const { data: existingContact } = await supabase
              .from("contacts")
              .select("id")
              .eq("linkedin_url", conn.person?.linkedin_profile_url)
              .single();

            const connectionName = `${conn.person?.first_name || ""} ${conn.person?.last_name || ""}`.trim() || "Unknown";
            
            const { error: connError } = await supabase.from("linkedin_connections").upsert(
              {
                linkedin_id: linkedinId,
                name: connectionName,
                headline: conn.person?.headline,
                company: conn.person?.company,
                profile_url: conn.person?.linkedin_profile_url,
                connection_status: "Connected",
                synced_at: new Date().toISOString(),
                contact_id: existingContact?.id || null,
              },
              { onConflict: "linkedin_id" }
            );
            
            if (connError) {
              console.error("Connection upsert error:", connError);
              results.connections.errors.push(`Connection upsert: ${connError.message}`);
            } else {
              results.connections.synced++;
              console.log(`Synced connection: ${connectionName}`);
            }
          } catch (e) {
            console.error("Error processing connection:", e);
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
        results.leads.found = leads.length;
        
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

            const leadName = `${lead.person?.first_name || ""} ${lead.person?.last_name || ""}`.trim() || null;
            
            // For leads without email, use insert to avoid conflict issues
            if (!lead.person?.email) {
              const { error: leadError } = await supabase.from("leads").insert({
                contact_id: contactId,
                contact_name: leadName,
                company_name: lead.person?.company || null,
                email: null,
                source: `Meet Alfred - ${lead.campaign?.name || "Campaign"}`,
                status: "New",
                notes: lead.person?.headline ? `Headline: ${lead.person.headline}` : null,
              });
              
              if (leadError) {
                console.error("Lead insert error:", leadError);
                results.leads.errors.push(`Lead insert: ${leadError.message}`);
              } else {
                results.leads.synced++;
                console.log(`Synced lead: ${leadName || "Unknown"}`);
              }
            } else {
              // Use upsert for leads with email
              const { error: leadError } = await supabase.from("leads").upsert(
                {
                  contact_id: contactId,
                  contact_name: leadName,
                  company_name: lead.person?.company || null,
                  email: lead.person.email,
                  source: `Meet Alfred - ${lead.campaign?.name || "Campaign"}`,
                  status: "New",
                  notes: lead.person?.headline ? `Headline: ${lead.person.headline}` : null,
                },
                { onConflict: "email", ignoreDuplicates: true }
              );
              
              if (leadError) {
                console.error("Lead upsert error:", leadError);
                results.leads.errors.push(`Lead upsert: ${leadError.message}`);
              } else {
                results.leads.synced++;
                console.log(`Synced lead: ${leadName || "Unknown"}`);
              }
            }
          } catch (e) {
            console.error("Error processing lead:", e);
            results.leads.errors.push(String(e));
          }
        }
      } catch (e) {
        console.error("Error syncing leads:", e);
        results.leads.errors.push(String(e));
      }
    }

    console.log("Sync complete:", JSON.stringify(results, null, 2));

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
  return match ? match[1] : null;
}
