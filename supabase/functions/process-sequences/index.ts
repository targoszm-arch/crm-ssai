import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Processing pending sequence emails...");

    // Find enrollments that are due for their next email
    const now = new Date().toISOString();
    const { data: dueEnrollments, error: fetchError } = await supabase
      .from("sequence_enrollments")
      .select(`
        id,
        sequence_id,
        contact_id,
        current_step,
        sequences (
          id,
          name,
          steps,
          from_email,
          from_name
        ),
        contacts (
          id,
          first_name,
          last_name,
          email,
          companies (
            company_name
          )
        )
      `)
      .eq("status", "active")
      .lte("next_email_at", now);

    if (fetchError) {
      console.error("Error fetching due enrollments:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${dueEnrollments?.length || 0} enrollments due for emails`);

    const results = {
      processed: 0,
      sent: 0,
      errors: [] as string[],
    };

    for (const enrollment of dueEnrollments || []) {
      results.processed++;
      
      try {
        const sequence = enrollment.sequences as any;
        const contact = enrollment.contacts as any;
        
        if (!contact?.email) {
          console.log(`Skipping enrollment ${enrollment.id} - no email`);
          continue;
        }

        const steps = sequence?.steps as any[];
        if (!steps || enrollment.current_step >= steps.length) {
          // Mark as completed
          await supabase
            .from("sequence_enrollments")
            .update({ status: "completed", completed_at: now })
            .eq("id", enrollment.id);
          continue;
        }

        const currentStepData = steps[enrollment.current_step];
        const templateId = currentStepData.template || currentStepData.template_id;

        // Fetch template from database
        let templateSubject = currentStepData.subject || "Message from us";
        let templateBody = "<p>Thank you for being a customer!</p>";

        if (templateId) {
          const { data: template, error: templateError } = await supabase
            .from("email_templates")
            .select("subject, body_html")
            .eq("id", templateId)
            .single();

          if (template && !templateError) {
            templateSubject = currentStepData.subject || template.subject || templateSubject;
            templateBody = template.body_html || templateBody;
            console.log(`Using template: ${templateId}`);
          } else {
            console.log(`Template ${templateId} not found, using fallback`);
          }
        }

        // Get company name from contact
        const companyName = contact.companies?.company_name || "";

        // Personalize the email with merge tags
        const personalizedSubject = templateSubject
          .replace(/{{first_name}}/g, contact.first_name || "there")
          .replace(/{{last_name}}/g, contact.last_name || "")
          .replace(/{{email}}/g, contact.email || "")
          .replace(/{{company}}/g, companyName);

        const personalizedBody = templateBody
          .replace(/{{first_name}}/g, contact.first_name || "there")
          .replace(/{{last_name}}/g, contact.last_name || "")
          .replace(/{{email}}/g, contact.email || "")
          .replace(/{{company}}/g, companyName);

        // Call send-sequence-email function
        const { error: sendError } = await supabase.functions.invoke("send-sequence-email", {
          body: {
            enrollment_id: enrollment.id,
            step_number: enrollment.current_step,
            subject: personalizedSubject,
            body_html: personalizedBody,
            to_email: contact.email,
            to_name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
            from_email: sequence?.from_email,
            from_name: sequence?.from_name,
          },
        });

        if (sendError) {
          console.error(`Error sending email for enrollment ${enrollment.id}:`, sendError);
          results.errors.push(`Enrollment ${enrollment.id}: ${sendError.message}`);
        } else {
          results.sent++;
          console.log(`✓ Sent email to ${contact.email} for sequence ${sequence?.name}`);
        }
      } catch (e) {
        console.error(`Error processing enrollment ${enrollment.id}:`, e);
        results.errors.push(`Enrollment ${enrollment.id}: ${String(e)}`);
      }
    }

    console.log("=== PROCESS SEQUENCES COMPLETE ===");
    console.log(JSON.stringify(results, null, 2));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Process sequences error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
