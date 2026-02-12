import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateReplyRequest {
  emailId: string;
  tone: "professional" | "casual" | "brief";
  context?: string;
}

// Strip HTML tags and get plain text for AI context
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { emailId, tone = "professional", context }: GenerateReplyRequest = await req.json();

    if (!emailId) {
      throw new Error("emailId is required");
    }

    console.log(`Generating ${tone} reply for email: ${emailId}`);

    // Fetch the email with contact and company info
    // Use explicit FK name to avoid ambiguity (contacts has two FKs to companies)
    const { data: email, error: emailError } = await supabase
      .from("emails")
      .select(`
        *,
        contacts (
          id,
          first_name,
          last_name,
          title,
          company_id,
          companies!contacts_company_id_fkey (
            company_name,
            industry
          )
        )
      `)
      .eq("id", emailId)
      .single();

    if (emailError || !email) {
      throw new Error(`Email not found: ${emailError?.message}`);
    }

    // Get the original email content
    const emailContent = email.body_html 
      ? stripHtml(email.body_html) 
      : email.snippet || "";

    // Build context about the sender
    const contact = email.contacts;
    const company = contact?.companies;
    
    let senderContext = "";
    if (contact) {
      senderContext = `Sender: ${contact.first_name} ${contact.last_name || ""}`;
      if (contact.title) senderContext += `, ${contact.title}`;
      if (company?.company_name) senderContext += ` at ${company.company_name}`;
      if (company?.industry) senderContext += ` (${company.industry} industry)`;
    }

    // Build the prompt
    const toneInstructions = {
      professional: "Write in a formal, professional business tone. Be polite, clear, and thorough.",
      casual: "Write in a friendly, conversational tone while remaining appropriate for business.",
      brief: "Be concise and to the point. Use short sentences and get straight to the key points.",
    };

    const prompt = `You are helping draft an email reply. ${toneInstructions[tone]}

ORIGINAL EMAIL:
From: ${email.from_name || email.from_email}
Subject: ${email.subject || "(No subject)"}

${emailContent}

${senderContext ? `---\nCONTEXT:\n${senderContext}` : ""}
${context ? `\nAdditional context: ${context}` : ""}

---
INSTRUCTIONS:
- Write a ${tone} reply to this email
- Address their main points or questions
- Do NOT include a subject line
- Do NOT include greeting like "Dear" or signature - just the body
- Keep it natural and human-sounding
- If you don't have enough context to fully respond, acknowledge what you can and offer to provide more information`;

    // Call OpenAI
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that drafts professional email replies. Write clear, natural responses that directly address the sender's message.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const suggestedReply = openaiData.choices?.[0]?.message?.content?.trim() || "";

    if (!suggestedReply) {
      throw new Error("No reply generated");
    }

    console.log(`Generated ${tone} reply (${suggestedReply.length} chars)`);

    return new Response(
      JSON.stringify({
        success: true,
        reply: suggestedReply,
        tone,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error generating reply:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
