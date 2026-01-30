import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-extension-key",
};

interface LinkedInConnection {
  linkedin_id: string;
  name: string;
  headline?: string;
  profile_url?: string;
  company?: string;
}

interface SyncRequest {
  connections: LinkedInConnection[];
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

    // Validate extension key if configured
    const extensionKey = req.headers.get("x-extension-key");
    const expectedKey = Deno.env.get("LINKEDIN_EXTENSION_KEY");
    
    if (expectedKey && extensionKey !== expectedKey) {
      console.error("Invalid extension key");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SyncRequest = await req.json();
    console.log(`Syncing ${body.connections?.length || 0} LinkedIn connections`);

    if (!body.connections || !Array.isArray(body.connections)) {
      return new Response(
        JSON.stringify({ error: "connections array required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let syncedCount = 0;
    let linkedToContactCount = 0;

    for (const conn of body.connections) {
      if (!conn.linkedin_id || !conn.name) {
        console.log("Skipping connection with missing required fields");
        continue;
      }

      // Try to find a matching contact by LinkedIn URL
      let contactId: string | null = null;
      if (conn.profile_url) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("id")
          .ilike("linkedin_url", `%${conn.linkedin_id}%`)
          .single();
        
        if (contact) {
          contactId = contact.id;
          linkedToContactCount++;
        }
      }

      // Try to find a matching company
      let companyId: string | null = null;
      if (conn.company) {
        const { data: company } = await supabase
          .from("companies")
          .select("id")
          .ilike("company_name", conn.company)
          .single();
        
        if (company) {
          companyId = company.id;
        }
      }

      // Upsert the connection
      const { error } = await supabase
        .from("linkedin_connections")
        .upsert(
          {
            linkedin_id: conn.linkedin_id,
            name: conn.name,
            headline: conn.headline,
            profile_url: conn.profile_url,
            company: conn.company,
            contact_id: contactId,
            company_id: companyId,
            synced_at: new Date().toISOString(),
            connection_status: "Connected",
          },
          {
            onConflict: "linkedin_id",
          }
        );

      if (error) {
        console.error("Upsert error for connection:", conn.linkedin_id, error);
      } else {
        syncedCount++;
      }
    }

    console.log(`Synced ${syncedCount} connections, linked ${linkedToContactCount} to contacts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        syncedCount, 
        linkedToContactCount,
        totalReceived: body.connections.length 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("LinkedIn connections sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
