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
  status?: string;
  sequence_type?: string;
  total_leads?: number;
}

interface MeetAlfredReply {
  id: number;
  reply_detected_on?: string;
  created_at?: string;
  timestamp?: string;
  date?: string;
  // Root-level fields (Meet Alfred returns these at root!)
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  linkedin_profile_url?: string;
  linkedin_conversation_url?: string;
  companyName?: string;
  campaign_name?: string;
  reply_message?: string;
  // Nested person/lead info (fallback)
  person?: MeetAlfredPerson;
  lead?: MeetAlfredPerson;
  contact?: MeetAlfredPerson;
  // Campaign info
  campaign?: MeetAlfredCampaign;
  sequence?: MeetAlfredCampaign;
  // Legacy field names
  message?: string;
  text?: string;
  content?: string;
  body?: string;
  reply_text?: string;
  reply_content?: string;
  action?: {
    type?: string;
    message?: string;
    text?: string;
  };
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
      campaigns: { found: 0, synced: 0, errors: [] as string[] },
      replies: { found: 0, synced: 0, errors: [] as string[], pages_fetched: 0 },
      connections: { found: 0, synced: 0, errors: [] as string[] },
      leads: { found: 0, synced: 0, errors: [] as string[] },
      activities: { created: 0, errors: [] as string[] },
    };

    // Sync Campaigns FIRST - use the documented Get Campaigns API
    if (syncType === "all" || syncType === "campaigns") {
      try {
        console.log("=== SYNCING MEET ALFRED CAMPAIGNS ===");
        const campaignsUrl = `https://meetalfred.com/api/integrations/webhook/campaigns?webhook_key=${webhookKey}&type=all`;
        
        const campaignsRes = await fetch(campaignsUrl);
        if (!campaignsRes.ok) {
          throw new Error(`Meet Alfred Campaigns API error: ${campaignsRes.status}`);
        }
        
        const campaignsData = await campaignsRes.json();
        console.log("=== CAMPAIGNS API RAW RESPONSE ===");
        console.log(JSON.stringify(campaignsData, null, 2));
        
        // Campaigns could be in different array locations
        const campaigns = campaignsData.campaigns || campaignsData.data || campaignsData || [];
        const campaignsArray = Array.isArray(campaigns) ? campaigns : [];
        results.campaigns.found = campaignsArray.length;
        
        console.log(`Found ${campaignsArray.length} campaigns`);

        for (const campaign of campaignsArray) {
          try {
            console.log(`Processing campaign ${campaign.id}:`, JSON.stringify(campaign, null, 2));
            
            // Try multiple field names - Meet Alfred API may use different names
            const campaignName = 
              campaign.name || 
              campaign.sequence_name || 
              campaign.title || 
              campaign.campaign_name ||
              `Campaign ${campaign.id}`;
            
            const totalLeads = 
              campaign.total_leads || 
              campaign.leads_count || 
              campaign.people_count ||
              campaign.contacts_count ||
              campaign.count ||
              0;
            
            const sentCount = 
              campaign.sent_count ||
              campaign.messages_sent ||
              campaign.sent ||
              0;
            
            const sequenceType = 
              campaign.sequence_type || 
              campaign.type || 
              campaign.campaign_type ||
              null;
            
            const status = 
              campaign.status || 
              (campaign.is_active === true ? "active" : 
               campaign.is_active === false ? "paused" : "active");
            
            console.log(`Extracted: name="${campaignName}", leads=${totalLeads}, sent=${sentCount}, status=${status}`);
            
            const { error: campError } = await supabase.from("campaigns").upsert(
              {
                meetalfred_id: campaign.id,
                name: campaignName,
                type: campaign.type || sequenceType || "linkedin",
                status: status,
                sequence_type: sequenceType,
                total_leads: totalLeads,
                sent_count: sentCount,
                last_synced_at: new Date().toISOString(),
              },
              { onConflict: "meetalfred_id" }
            );
            
            if (campError) {
              console.error("Campaign upsert error:", campError);
              results.campaigns.errors.push(`Campaign ${campaign.id}: ${campError.message}`);
            } else {
              results.campaigns.synced++;
              console.log(`✓ Synced campaign: ${campaignName}`);
            }
          } catch (e) {
            console.error("Error processing campaign:", e);
            results.campaigns.errors.push(String(e));
          }
        }
      } catch (e) {
        console.error("Error syncing campaigns:", e);
        results.campaigns.errors.push(String(e));
      }
    }

    // Sync Replies with pagination for 30-day backfill
    if (syncType === "all" || syncType === "replies") {
      try {
        let currentPage = 0;
        let hasMoreData = true;
        let oldestReplyInBatch: Date | null = null;

        console.log("\n=== STARTING MEET ALFRED REPLIES SYNC ===");
        console.log(`Backfill target: Last 30 days (since ${thirtyDaysAgo.toISOString()})`);

        // Use Get Replies endpoint
        const baseUrl = "https://meetalfred.com/api/integrations/webhook/get-replies";
        
        while (hasMoreData) {
          const repliesUrl = `${baseUrl}?webhook_key=${webhookKey}&page=${currentPage}&per_page=${perPage}`;
          console.log(`\nFetching replies page ${currentPage}...`);
          
          const repliesRes = await fetch(repliesUrl);
          
          if (!repliesRes.ok) {
            const errorText = await repliesRes.text();
            console.error(`API Error (${repliesRes.status}): ${errorText}`);
            
            // Try alternative endpoints
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
                await processReplies(fallbackData, supabase, results, thirtyDaysAgo);
                hasMoreData = false;
                continue;
              }
              
              const altData = await altRes.json();
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
        const connections = connectionsData.actions || [];
        results.connections.found = connections.length;
        
        console.log(`Found ${connections.length} connections`);

        for (const conn of connections) {
          try {
            const linkedinId = extractLinkedInId(conn.person?.linkedin_profile_url || conn.linkedin_profile_url);
            if (!linkedinId) {
              console.log("Skipping connection - no LinkedIn ID found");
              continue;
            }

            // Try to find or create contact
            const contactId = await findOrCreateContact(supabase, conn.person || conn, results);

            const connectionName = conn.name || `${conn.person?.first_name || conn.first_name || ""} ${conn.person?.last_name || conn.last_name || ""}`.trim() || "Unknown";
            
            const { error: connError } = await supabase.from("linkedin_connections").upsert(
              {
                linkedin_id: linkedinId,
                name: connectionName,
                headline: conn.person?.headline || conn.headline,
                company: conn.person?.company || conn.companyName || conn.company,
                profile_url: conn.person?.linkedin_profile_url || conn.linkedin_profile_url,
                connection_status: "Connected",
                synced_at: new Date().toISOString(),
                contact_id: contactId,
              },
              { onConflict: "linkedin_id" }
            );
            
            if (connError) {
              console.error("Connection upsert error:", connError);
              results.connections.errors.push(`Connection upsert: ${connError.message}`);
            } else {
              results.connections.synced++;
              
              // Log activity
              if (contactId) {
                await logActivity(supabase, {
                  contact_id: contactId,
                  activity_type: "linkedin_connection",
                  description: `Connected on LinkedIn`,
                  source: "meetalfred",
                  source_id: String(conn.id),
                  metadata: { campaign: conn.campaign?.name },
                }, results);
              }
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
        const leads = leadsData.actions || [];
        results.leads.found = leads.length;
        
        console.log(`Found ${leads.length} leads`);

        for (const lead of leads) {
          try {
            // Try to find or create contact from lead data
            const personData = lead.person || lead;
            const contactId = await findOrCreateContact(supabase, personData, results);
            
            const leadName = lead.name || `${personData.first_name || ""} ${personData.last_name || ""}`.trim() || null;
            const email = personData.email || lead.email || null;
            
            if (!email) {
              const { error: leadError } = await supabase.from("leads").insert({
                contact_id: contactId,
                contact_name: leadName,
                company_name: personData.company || lead.companyName || null,
                email: null,
                source: `Meet Alfred - ${lead.campaign?.name || lead.campaign_name || "Campaign"}`,
                status: "New",
                notes: personData.headline ? `Headline: ${personData.headline}` : null,
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
                  company_name: personData.company || lead.companyName || null,
                  email: email,
                  source: `Meet Alfred - ${lead.campaign?.name || lead.campaign_name || "Campaign"}`,
                  status: "New",
                  notes: personData.headline ? `Headline: ${personData.headline}` : null,
                },
                { onConflict: "email", ignoreDuplicates: true }
              );
              
              if (leadError) {
                results.leads.errors.push(`Lead upsert: ${leadError.message}`);
              } else {
                results.leads.synced++;
              }
            }
            
            // Log activity
            if (contactId) {
              await logActivity(supabase, {
                contact_id: contactId,
                activity_type: "linkedin_lead",
                description: `Added as lead from campaign: ${lead.campaign?.name || lead.campaign_name || "Unknown"}`,
                source: "meetalfred",
                source_id: String(lead.id),
                metadata: { campaign: lead.campaign?.name || lead.campaign_name },
              }, results);
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
      console.log(`\n=== REPLY ${reply.id} RAW DATA ===`);
      console.log(JSON.stringify(reply, null, 2));
      
      // CRITICAL FIX: Check ROOT level fields FIRST (Meet Alfred returns data here!)
      const firstName = reply.first_name || reply.person?.first_name || reply.lead?.first_name || "";
      const lastName = reply.last_name || reply.person?.last_name || reply.lead?.last_name || "";
      const personName = reply.name || `${firstName} ${lastName}`.trim() || "Unknown";
      
      // Profile URL - ROOT level first
      const profileUrl = 
        reply.linkedin_profile_url || 
        reply.person?.linkedin_profile_url || 
        reply.lead?.linkedin_profile_url || 
        null;
      
      // Conversation URL (direct link to message thread!)
      const conversationUrl = reply.linkedin_conversation_url || null;
      
      // Campaign name - ROOT level
      const campaignName = 
        reply.campaign_name || 
        reply.campaign?.name || 
        reply.sequence?.name || 
        null;
      
      // Company name
      const companyName = reply.companyName || reply.company || reply.person?.company || null;
      
      // Email for contact matching
      const email = reply.email || reply.person?.email || null;
      
      // Message text - try ALL possible field names
      const messageText = 
        reply.reply_message ||
        reply.message || 
        reply.text || 
        reply.content || 
        reply.body ||
        reply.reply_text ||
        reply.reply_content ||
        reply.action?.message ||
        reply.action?.text ||
        (typeof reply.action === 'string' ? reply.action : null) ||
        "No message content available";
      
      // Timestamp
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

      // Extract LinkedIn ID
      const linkedinId = extractLinkedInId(profileUrl);

      console.log(`Extracted data for reply ${reply.id}:`);
      console.log(`  - Name: ${personName}`);
      console.log(`  - Email: ${email || "N/A"}`);
      console.log(`  - Profile URL: ${profileUrl || "N/A"}`);
      console.log(`  - Conversation URL: ${conversationUrl || "N/A"}`);
      console.log(`  - LinkedIn ID: ${linkedinId || "N/A"}`);
      console.log(`  - Campaign: ${campaignName || "N/A"}`);
      console.log(`  - Company: ${companyName || "N/A"}`);
      console.log(`  - Message: ${messageText.substring(0, 100)}...`);

      // Try to find or create contact
      const personData = {
        first_name: firstName,
        last_name: lastName,
        email: email,
        linkedin_profile_url: profileUrl,
        company: companyName,
        headline: reply.headline || reply.person?.headline,
      };
      const contactId = await findOrCreateContact(supabase, personData, results);

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
              headline: reply.headline || reply.person?.headline,
              company: companyName,
              profile_url: profileUrl,
              connection_status: "Connected",
              synced_at: new Date().toISOString(),
              contact_id: contactId,
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

      // Insert/update the reply message with ALL extracted data
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
          linkedin_conversation_url: conversationUrl,
          company_name: companyName,
          raw_payload: reply,
        },
        { onConflict: "sender_linkedin_id,message_timestamp" }
      );
      
      if (msgError) {
        console.error("Message upsert error:", msgError);
        results.replies.errors.push(`Message upsert: ${msgError.message}`);
      } else {
        results.replies.synced++;
        console.log(`✓ Synced reply from ${personName}`);
        
        // Log activity
        if (contactId) {
          await logActivity(supabase, {
            contact_id: contactId,
            activity_type: "linkedin_reply",
            description: `Replied to LinkedIn message: "${messageText.substring(0, 50)}..."`,
            source: "meetalfred",
            source_id: String(reply.id),
            metadata: { campaign: campaignName, message_preview: messageText.substring(0, 200) },
          }, results);
        }
      }
    } catch (e) {
      console.error("Error processing reply:", e);
      results.replies.errors.push(String(e));
    }
  }

  return { oldestDate };
}

async function findOrCreateContact(
  supabase: any,
  personData: any,
  results: any
): Promise<string | null> {
  const email = personData.email;
  const linkedinUrl = personData.linkedin_profile_url;
  const firstName = personData.first_name || "";
  const lastName = personData.last_name || "";
  
  if (!email && !linkedinUrl && !firstName) {
    return null;
  }

  try {
    // Try to find existing contact by email first
    if (email) {
      const { data: emailContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("email", email)
        .single();
      
      if (emailContact?.id) {
        console.log(`Found existing contact by email: ${email}`);
        return emailContact.id;
      }
    }

    // Try to find by LinkedIn URL
    if (linkedinUrl) {
      const { data: linkedinContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("linkedin_url", linkedinUrl)
        .single();
      
      if (linkedinContact?.id) {
        console.log(`Found existing contact by LinkedIn: ${linkedinUrl}`);
        return linkedinContact.id;
      }
    }

    // Create new contact if we have enough data
    if (firstName || email) {
      const { data: newContact, error: createError } = await supabase
        .from("contacts")
        .insert({
          first_name: firstName || "Unknown",
          last_name: lastName || null,
          email: email || null,
          linkedin_url: linkedinUrl || null,
          title: personData.headline || null,
          notes: `Imported from Meet Alfred`,
        })
        .select("id")
        .single();
      
      if (createError) {
        console.error("Error creating contact:", createError);
        return null;
      }
      
      console.log(`✓ Created new contact: ${firstName} ${lastName}`);
      return newContact?.id || null;
    }
  } catch (e) {
    console.error("Error in findOrCreateContact:", e);
  }
  
  return null;
}

async function logActivity(
  supabase: any,
  activity: {
    contact_id?: string | null;
    company_id?: string | null;
    activity_type: string;
    description: string;
    source: string;
    source_id?: string;
    metadata?: any;
  },
  results: any
): Promise<void> {
  if (!activity.contact_id && !activity.company_id) {
    return;
  }
  
  try {
    const { error } = await supabase.from("activities").insert({
      contact_id: activity.contact_id,
      company_id: activity.company_id,
      activity_type: activity.activity_type,
      description: activity.description,
      source: activity.source,
      source_id: activity.source_id,
      metadata: activity.metadata,
      occurred_at: new Date().toISOString(),
    });
    
    if (error) {
      console.error("Activity log error:", error);
      results.activities.errors.push(error.message);
    } else {
      results.activities.created++;
    }
  } catch (e) {
    console.error("Error logging activity:", e);
    results.activities.errors.push(String(e));
  }
}

function extractLinkedInId(url?: string | null): string | null {
  if (!url) return null;
  // Handle both /in/username and /in/ACoXXX format
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  return match ? match[1] : null;
}
