import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  enrollment_id: string;
  step_number: number;
  subject: string;
  body_html: string;
  to_email: string;
  to_name?: string;
  from_email?: string;
  from_name?: string;
}

// Add tracking pixel to email HTML
function injectTrackingPixel(html: string, sequenceEmailId: string, supabaseUrl: string): string {
  const trackingPixel = `<img src="${supabaseUrl}/functions/v1/track-sequence-open?seid=${sequenceEmailId}" width="1" height="1" style="display:none;visibility:hidden;" alt="" />`;
  if (html.toLowerCase().includes("</body>")) {
    return html.replace(/<\/body>/i, `${trackingPixel}</body>`);
  }
  return html + trackingPixel;
}

// Wrap links for click tracking
function wrapLinksForTracking(html: string, sequenceEmailId: string, supabaseUrl: string): string {
  const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
  return html.replace(linkRegex, (match, url) => {
    // Skip tracking URLs and unsubscribe links
    if (url.includes("/functions/v1/track-") || url.includes("unsubscribe")) {
      return match;
    }
    const encodedUrl = encodeURIComponent(url);
    return `href="${supabaseUrl}/functions/v1/track-sequence-click?seid=${sequenceEmailId}&url=${encodedUrl}"`;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: SendEmailRequest = await req.json();
    const { enrollment_id, step_number, subject, body_html, to_email, to_name, from_email, from_name } = payload;

    console.log(`Sending sequence email step ${step_number} to ${to_email}`);

    // Create sequence_email record first
    const { data: sequenceEmail, error: createError } = await supabase
      .from("sequence_emails")
      .insert({
        enrollment_id,
        step_number,
        subject,
        body_html,
        status: "sending",
        delivery_status: "pending",
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating sequence_email:", createError);
      throw createError;
    }

    // Add tracking to the email
    let trackedHtml = body_html;
    trackedHtml = wrapLinksForTracking(trackedHtml, sequenceEmail.id, supabaseUrl);
    trackedHtml = injectTrackingPixel(trackedHtml, sequenceEmail.id, supabaseUrl);

    console.log("Tracking added to email, sending via Resend...");

    // Send email via Resend
    const fromAddress = from_email || "noreply@crm-ssai.lovable.app";
    const fromDisplay = from_name ? `${from_name} <${fromAddress}>` : fromAddress;

    const { data: emailResult, error: sendError } = await resend.emails.send({
      from: fromDisplay,
      to: [to_email],
      subject: subject,
      html: trackedHtml,
    });

    if (sendError) {
      console.error("Resend error:", sendError);
      // Update sequence_email with error
      await supabase
        .from("sequence_emails")
        .update({ status: "failed" })
        .eq("id", sequenceEmail.id);
      throw sendError;
    }

    console.log("Email sent successfully:", emailResult);

    // Update sequence_email with Resend message ID
    await supabase
      .from("sequence_emails")
      .update({
        resend_message_id: emailResult?.id,
        status: "sent",
        delivery_status: "delivered",
        sent_at: new Date().toISOString(),
      })
      .eq("id", sequenceEmail.id);

    console.log(`✓ Sequence email sent to ${to_email} with tracking`);

    // Update enrollment with next step info
    const { data: enrollment } = await supabase
      .from("sequence_enrollments")
      .select("sequence_id, current_step")
      .eq("id", enrollment_id)
      .single();

    if (enrollment) {
      const { data: sequence } = await supabase
        .from("sequences")
        .select("steps")
        .eq("id", enrollment.sequence_id)
        .single();

      if (sequence?.steps) {
        // Handle double-encoded steps (JSON string inside JSONB)
        let steps = sequence.steps;
        if (typeof steps === "string") {
          try {
            steps = JSON.parse(steps);
            console.log(`Parsed steps from string: ${steps.length} steps`);
          } catch (e) {
            console.error("Failed to parse steps:", e);
            steps = [];
          }
        }
        const nextStepIndex = step_number + 1;
        const currentStep = Array.isArray(steps) ? steps[step_number] : null;
        
        if (nextStepIndex < steps.length && currentStep) {
          const nextStep = steps[nextStepIndex];
          const dayDiff = (nextStep?.day || 0) - (currentStep?.day || 0);
          const nextEmailDate = new Date();
          nextEmailDate.setDate(nextEmailDate.getDate() + Math.max(1, dayDiff));
          
          await supabase
            .from("sequence_enrollments")
            .update({
              current_step: nextStepIndex,
              next_email_at: nextEmailDate.toISOString(),
            })
            .eq("id", enrollment_id);
        } else {
          // Sequence complete
          await supabase
            .from("sequence_enrollments")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              next_email_at: null,
            })
            .eq("id", enrollment_id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message_id: emailResult?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send sequence email error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
