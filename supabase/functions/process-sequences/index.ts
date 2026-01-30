import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Email templates for different sequence types
const emailTemplates: Record<string, Record<string, { subject: string; body: string }>> = {
  welcome_intro: {
    default: {
      subject: "Welcome to our community!",
      body: `<h1>Welcome!</h1>
        <p>We're thrilled to have you join our community.</p>
        <p>Over the next few days, we'll share some tips to help you get the most out of our platform.</p>
        <p>If you have any questions, just reply to this email!</p>`,
    },
  },
  welcome_tips: {
    default: {
      subject: "Getting started tips",
      body: `<h1>Quick Tips to Get Started</h1>
        <p>Here are a few things that our most successful users do:</p>
        <ul>
          <li>Complete your profile</li>
          <li>Explore the dashboard</li>
          <li>Connect with your team</li>
        </ul>`,
    },
  },
  welcome_features: {
    default: {
      subject: "Discover our best features",
      body: `<h1>Features You'll Love</h1>
        <p>Did you know you can:</p>
        <ul>
          <li>Track all your customer interactions</li>
          <li>Automate your email sequences</li>
          <li>Get AI-powered insights</li>
        </ul>`,
    },
  },
  welcome_checkin: {
    default: {
      subject: "How are you finding things?",
      body: `<h1>Quick Check-in</h1>
        <p>We hope you're settling in well!</p>
        <p>Is there anything we can help you with? Just reply to this email.</p>`,
    },
  },
  upsell_recommendations: {
    default: {
      subject: "You might also love these...",
      body: `<h1>Recommended for You</h1>
        <p>Based on your recent activity, we think you'd love these:</p>`,
    },
  },
  upsell_case_study: {
    default: {
      subject: "Success story: How others use our products",
      body: `<h1>Customer Success Story</h1>
        <p>See how other customers are getting results with our platform.</p>`,
    },
  },
  upsell_offer: {
    default: {
      subject: "Exclusive offer just for you",
      body: `<h1>Special Offer</h1>
        <p>As a valued customer, we'd like to offer you an exclusive deal.</p>`,
    },
  },
  content_delivery: {
    default: {
      subject: "Here's your download",
      body: `<h1>Your Download is Ready</h1>
        <p>Thank you for your interest! Here's the content you requested.</p>`,
    },
  },
  content_related: {
    default: {
      subject: "More resources you'll find useful",
      body: `<h1>More Resources</h1>
        <p>Since you enjoyed our content, here are some related resources:</p>`,
    },
  },
  content_intro: {
    default: {
      subject: "How we can help you succeed",
      body: `<h1>Let's Talk About Your Goals</h1>
        <p>Now that you've seen what we offer, let's discuss how we can help you succeed.</p>`,
    },
  },
  content_followup: {
    default: {
      subject: "Quick question for you",
      body: `<h1>Quick Question</h1>
        <p>Did you find the content helpful? We'd love to hear your feedback.</p>`,
    },
  },
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
          email
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
        const templateKey = currentStepData.template;
        const template = emailTemplates[templateKey]?.default || {
          subject: currentStepData.subject || "Message from us",
          body: `<p>Thank you for being a customer!</p>`,
        };

        // Personalize the email
        const personalizedSubject = template.subject
          .replace("{{first_name}}", contact.first_name || "there");
        const personalizedBody = template.body
          .replace(/{{first_name}}/g, contact.first_name || "there")
          .replace(/{{last_name}}/g, contact.last_name || "");

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
