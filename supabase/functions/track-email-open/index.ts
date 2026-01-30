import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 1x1 transparent PNG pixel
const TRACKING_PIXEL = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44,
  0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d,
  0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
  0x60, 0x82,
]);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const emailId = url.searchParams.get("eid");

    if (!emailId) {
      console.log("No email ID provided");
      return new Response(TRACKING_PIXEL, {
        headers: {
          ...corsHeaders,
          "Content-Type": "image/png",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      });
    }

    console.log(`Tracking open for email: ${emailId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get email details
    const { data: email, error: emailError } = await supabase
      .from("emails")
      .select("id, contact_id, open_count, first_opened_at")
      .eq("id", emailId)
      .single();

    if (emailError || !email) {
      console.error("Email not found:", emailError);
      return new Response(TRACKING_PIXEL, {
        headers: {
          ...corsHeaders,
          "Content-Type": "image/png",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      });
    }

    const now = new Date().toISOString();
    const userAgent = req.headers.get("user-agent") || null;
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

    // Record tracking event
    const { error: eventError } = await supabase
      .from("email_tracking_events")
      .insert({
        email_id: emailId,
        contact_id: email.contact_id,
        event_type: "open",
        user_agent: userAgent,
        ip_address: ipAddress,
        occurred_at: now,
      });

    if (eventError) {
      console.error("Error recording tracking event:", eventError);
    }

    // Update email open stats
    const updateData: Record<string, any> = {
      open_count: (email.open_count || 0) + 1,
      last_opened_at: now,
    };

    if (!email.first_opened_at) {
      updateData.first_opened_at = now;
    }

    const { error: updateError } = await supabase
      .from("emails")
      .update(updateData)
      .eq("id", emailId);

    if (updateError) {
      console.error("Error updating email:", updateError);
    }

    // Update contact engagement stats
    if (email.contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("total_opens")
        .eq("id", email.contact_id)
        .single();

      await supabase
        .from("contacts")
        .update({
          total_opens: (contact?.total_opens || 0) + 1,
        })
        .eq("id", email.contact_id);
    }

    console.log(`Successfully tracked open for email: ${emailId}`);

    return new Response(TRACKING_PIXEL, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Error in track-email-open:", error);
    return new Response(TRACKING_PIXEL, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
      },
    });
  }
});
