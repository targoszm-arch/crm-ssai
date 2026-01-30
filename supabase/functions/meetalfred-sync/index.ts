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
  reply_detected_on?: string;
  created_at?: string;
  timestamp?: string;
  date?: string;
  // Try all possible message field names
  message?: string;
  text?: string;
  content?: string;
  body?: string;
  reply_message?: string;
  reply_text?: string;
  reply_content?: string;
  // Person/lead info - could be nested differently
  person?: MeetAlfredPerson;
  lead?: MeetAlfredPerson;
  contact?: MeetAlfredPerson;
  // Campaign info
  campaign?: MeetAlfredCampaign;
  sequence?: MeetAlfredCampaign;
  // Action details
  action?: {
    type?: string;
    message?: string;
    text?: string;
  };
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
    const perPage = parseInt(url.searchParams.get("per_page") || "100");

    // Calculate 30 days ago for backfill
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const results = {
      replies: { found: 0, synced: 0, errors: [] as string[], pages_fetched: 0 },
      connections: { found: 0, synced: 0, errors: [] as string[] },
      leads: { found: 0, synced: 0, errors: [] as string[] },
    };

    // Sync Replies with pagination for 30-day backfill
    if (syncType === "all" || syncType === "replies") {
      try {
        let currentPage = 0;
        let hasMoreData = true;
        let oldestReplyInBatch: Date | null = null;

        console.log("=== STARTING MEET ALFRED REPLIES SYNC ===");
        console.log(`Backfill target: Last 30 days (since ${thirtyDaysAgo.toISOString()})`);

        // Try the GET REPLIES endpoint (correct endpoint for fetching reply data)
        // Based on Meet Alfred API documentation patterns
        const baseUrl = "https://meetalfred.com/api/integrations/webhook/get-replies";
        
        while (hasMoreData) {
          const repliesUrl = `${baseUrl}?webhook_key=${webhookKey}&page=${currentPage}&per_page=${perPage}`;
          console.log(`\nFetching replies page ${currentPage}...`);
          
          const repliesRes = await fetch(repliesUrl);
          
          if (!repliesRes.ok) {
            const errorText = await repliesRes.text();
            console.error(`API Error (${repliesRes.status}): ${errorText}`);
            
            // If get-replies doesn't work, fall back to other endpoints
            if (currentPage === 0) {
              console.log("Trying alternative endpoint: /replies...");
              const altUrl = `https://meetalfred.com/api/integrations/webhook/replies?webhook_key=${webhookKey}&page=${currentPage}&per_page=${perPage}`;
              const altRes = await fetch(altUrl);
              
              if (!altRes.ok) {
                console.log("Trying alternative endpoint: /new-reply-detected...");
                const fallbackUrl = `https://meetalfred.com/api/integrations/webhook/new-reply-detected?webhook_key=${webhookKey}&page=${currentPage}&per_page=${perPage}`;
                const fallbackRes = await fetch(fallbackUrl);
                
                if (!fallbackRes.ok) {
                  throw new Error(`All Meet Alfred API endpoints failed. Last status: ${fallbackRes.status}`);
                }
                
                const fallbackData = await fallbackRes.json();
                console.log("=== FALLBACK ENDPOINT RAW RESPONSE ===");
                console.log(JSON.stringify(fallbackData, null, 2));
                console.log("=== END RAW RESPONSE ===");
                
                // Process fallback data
                await processReplies(fallbackData, supabase, results, thirtyDaysAgo);
                hasMoreData = false;
                continue;
              }
              
              const altData = await altRes.json();
              console.log("=== ALTERNATIVE ENDPOINT RAW RESPONSE ===");
              console.log(JSON.stringify(altData, null, 2));
              console.log("=== END RAW RESPONSE ===");
              
              await processReplies(altData, supabase, results, thirtyDaysAgo);
              hasMoreData = false;
              continue;
            }
            
            break;
          }
          
          const repliesData = await repliesRes.json();
          
          // Log FULL raw response on first page for debugging
          if (currentPage === 0) {
            console.log("=== FULL RAW API RESPONSE (PAGE 0) ===");
            console.log(JSON.stringify(repliesData, null, 2));
            console.log("=== END RAW RESPONSE ===");
          }

          const processResult = await processReplies(repliesData, supabase, results, thirtyDaysAgo);
          oldestReplyInBatch = processResult.oldestDate;
          
          results.replies.pages_fetched++;
          currentPage++;

          // Check if we should stop pagination
          const repliesArray = repliesData.actions || repliesData.replies || repliesData.data || [];
          if (repliesArray.length < perPage) {
            console.log("Reached end of replies (less than per_page returned)");
            hasMoreData = false;
          } else if (oldestReplyInBatch && oldestReplyInBatch < thirtyDaysAgo) {
            console.log("Reached 30-day backfill limit");
            hasMoreData = false;
          } else if (currentPage > 50) {
            console.log("Safety limit: stopped at 50 pages");
            hasMoreData = false;
          }
        }

        console.log(`\nReplies sync complete: ${results.replies.synced} synced from ${results.replies.found} found across ${results.replies.pages_fetched} pages`);
      } catch (e) {
        console.error("Error syncing replies:", e);
        results.replies.errors.push(String(e));
      }
    }

    // Sync Connections
    if (syncType === "all" || syncType === "connections") {
      try {
        const connectionsUrl = `https://meetalfred.com/api/integrations/webhook/new-connections?webhook_key=${webhookKey}&return_only_synced=true&page=0&per_page=${perPage}`;
        console.log("\nFetching connections from Meet Alfred...");
        
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
        const leadsUrl = `https://meetalfred.com/api/integrations/webhook/new-leads?webhook_key=${webhookKey}&page=0&per_page=${perPage}`;
        console.log("\nFetching leads from Meet Alfred...");
        
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
                results.leads.errors.push(`Lead insert: ${leadError.message}`);
              } else {
                results.leads.synced++;
              }
            } else {
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
                results.leads.errors.push(`Lead upsert: ${leadError.message}`);
              } else {
                results.leads.synced++;
              }
            }
          } catch (e) {
            results.leads.errors.push(String(e));
          }
        }
      } catch (e) {
        console.error("Error syncing leads:", e);
        results.leads.errors.push(String(e));
      }
    }

    console.log("\n=== SYNC COMPLETE ===");
    console.log(JSON.stringify(results, null, 2));

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

async function processReplies(
  repliesData: any, 
  supabase: any, 
  results: any, 
  thirtyDaysAgo: Date
): Promise<{ oldestDate: Date | null }> {
  // Try multiple possible array locations
  const replies = repliesData.actions || repliesData.replies || repliesData.data || [];
  
  if (!Array.isArray(replies)) {
    console.log("No replies array found in response. Keys:", Object.keys(repliesData));
    return { oldestDate: null };
  }

  results.replies.found += replies.length;
  console.log(`Processing ${replies.length} replies...`);

  let oldestDate: Date | null = null;

  for (const reply of replies) {
    try {
      // Log EVERY reply structure for debugging
      console.log(`\n=== REPLY ${reply.id} RAW DATA ===`);
      console.log(JSON.stringify(reply, null, 2));
      
      // Extract person data - try multiple possible locations
      const person = reply.person || reply.lead || reply.contact || {};
      
      // Extract message text - try ALL possible field names
      const messageText = 
        reply.message || 
        reply.text || 
        reply.content || 
        reply.body ||
        reply.reply_message ||
        reply.reply_text ||
        reply.reply_content ||
        reply.action?.message ||
        reply.action?.text ||
        (typeof reply.action === 'string' ? reply.action : null) ||
        "No message content available";
      
      // Extract timestamp
      const timestamp = 
        reply.reply_detected_on || 
        reply.created_at || 
        reply.timestamp || 
        reply.date ||
        new Date().toISOString();
      
      const replyDate = new Date(timestamp);
      if (!oldestDate || replyDate < oldestDate) {
        oldestDate = replyDate;
      }

      // Extract names
      const firstName = person.first_name || "";
      const lastName = person.last_name || "";
      const personName = `${firstName} ${lastName}`.trim() || "Unknown";
      
      // Extract profile URL
      const profileUrl = person.linkedin_profile_url || person.profile_url || null;
      
      // Extract LinkedIn ID
      const linkedinId = extractLinkedInId(profileUrl);
      
      // Extract campaign info
      const campaign = reply.campaign || reply.sequence || {};
      const campaignName = campaign.name || null;

      console.log(`Extracted data for reply ${reply.id}:`);
      console.log(`  - Name: ${personName}`);
      console.log(`  - Profile URL: ${profileUrl || "N/A"}`);
      console.log(`  - LinkedIn ID: ${linkedinId || "N/A"}`);
      console.log(`  - Campaign: ${campaignName || "N/A"}`);
      console.log(`  - Message: ${messageText.substring(0, 100)}...`);
      console.log(`  - Timestamp: ${timestamp}`);

      // Generate sender ID
      const senderId = linkedinId || `meetalfred_reply_${reply.id}`;

      // Create/update connection if we have LinkedIn ID
      let connectionId: string | null = null;
      if (linkedinId) {
        const { data: connection, error: connError } = await supabase
          .from("linkedin_connections")
          .upsert(
            {
              linkedin_id: linkedinId,
              name: personName,
              headline: person.headline,
              company: person.company,
              profile_url: profileUrl,
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

      // Insert/update the reply message with raw payload
      const { error: msgError } = await supabase.from("linkedin_messages").upsert(
        {
          sender_linkedin_id: senderId,
          recipient_linkedin_id: "me",
          message_text: messageText,
          message_timestamp: timestamp,
          connection_id: connectionId,
          is_read: false,
          sender_name: personName !== "Unknown" ? personName : null,
          campaign_name: campaignName,
          profile_url: profileUrl,
          raw_payload: reply, // Store complete raw payload for debugging
        },
        { onConflict: "sender_linkedin_id,message_timestamp" }
      );
      
      if (msgError) {
        console.error("Message upsert error:", msgError);
        results.replies.errors.push(`Message upsert: ${msgError.message}`);
      } else {
        results.replies.synced++;
        console.log(`✓ Synced reply from ${personName}`);
      }
    } catch (e) {
      console.error("Error processing reply:", e);
      results.replies.errors.push(String(e));
    }
  }

  return { oldestDate };
}

function extractLinkedInId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  return match ? match[1] : null;
}
