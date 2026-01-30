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
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating sequence_email:", createError);
      throw createError;
    }

    // Send email via Resend
    const fromAddress = from_email || "noreply@crm-ssai.lovable.app";
    const fromDisplay = from_name ? `${from_name} <${fromAddress}>` : fromAddress;

    const { data: emailResult, error: sendError } = await resend.emails.send({
      from: fromDisplay,
      to: [to_email],
      subject: subject,
      html: body_html,
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
        sent_at: new Date().toISOString(),
      })
      .eq("id", sequenceEmail.id);

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
        const steps = sequence.steps as any[];
        const nextStepIndex = step_number + 1;
        
        if (nextStepIndex < steps.length) {
          const nextStep = steps[nextStepIndex];
          const nextEmailDate = new Date();
          nextEmailDate.setDate(nextEmailDate.getDate() + (nextStep.day - steps[step_number].day));
          
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
