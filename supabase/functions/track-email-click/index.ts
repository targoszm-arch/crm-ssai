import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const emailId = url.searchParams.get("eid");
    const destinationUrl = url.searchParams.get("url");

    if (!destinationUrl) {
      console.error("No destination URL provided");
      return new Response("Missing URL parameter", { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const decodedUrl = decodeURIComponent(destinationUrl);
    console.log(`Tracking click for email: ${emailId}, URL: ${decodedUrl}`);

    if (emailId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get email details
      const { data: email, error: emailError } = await supabase
        .from("emails")
        .select("id, contact_id, click_count")
        .eq("id", emailId)
        .single();

      if (!emailError && email) {
        const now = new Date().toISOString();
        const userAgent = req.headers.get("user-agent") || null;
        const forwardedFor = req.headers.get("x-forwarded-for");
        const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

        // Record tracking event
        await supabase.from("email_tracking_events").insert({
          email_id: emailId,
          contact_id: email.contact_id,
          event_type: "click",
          link_url: decodedUrl,
          user_agent: userAgent,
          ip_address: ipAddress,
          occurred_at: now,
        });

        // Update email click count
        await supabase
          .from("emails")
          .update({
            click_count: (email.click_count || 0) + 1,
          })
          .eq("id", emailId);

        // Update contact engagement stats
        if (email.contact_id) {
          const { data: contact } = await supabase
            .from("contacts")
            .select("total_clicks")
            .eq("id", email.contact_id)
            .single();

          await supabase
            .from("contacts")
            .update({
              total_clicks: (contact?.total_clicks || 0) + 1,
            })
            .eq("id", email.contact_id);
        }

        console.log(`Successfully tracked click for email: ${emailId}`);
      }
    }

    // Redirect to destination
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": decodedUrl,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error in track-email-click:", error);
    
    // Try to redirect anyway
    const url = new URL(req.url);
    const destinationUrl = url.searchParams.get("url");
    if (destinationUrl) {
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": decodeURIComponent(destinationUrl),
        },
      });
    }
    
    return new Response("Error processing click", { 
      status: 500,
      headers: corsHeaders 
    });
  }
});
