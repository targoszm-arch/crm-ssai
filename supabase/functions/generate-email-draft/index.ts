import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateDraftRequest {
  to: string;
  subject: string;
  tone: "professional" | "casual" | "brief";
  context?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const { to, subject, tone = "professional", context }: GenerateDraftRequest = await req.json();

    if (!subject) {
      throw new Error("subject is required");
    }

    console.log(`Generating ${tone} email draft for subject: ${subject}`);

    const toneInstructions = {
      professional: "Write in a formal, professional business tone. Be polite, clear, and thorough.",
      casual: "Write in a friendly, conversational tone while remaining appropriate for business.",
      brief: "Be concise and to the point. Use short sentences and get straight to the key points.",
    };

    const prompt = `You are helping draft a new email. ${toneInstructions[tone]}

EMAIL DETAILS:
To: ${to || "recipient"}
Subject: ${subject}
${context ? `\nAdditional context: ${context}` : ""}

---
INSTRUCTIONS:
- Write a ${tone} email body based on the subject
- Do NOT include a subject line
- Do NOT include greeting like "Dear" or signature - just the body
- Keep it natural and human-sounding
- Make assumptions based on the subject if needed
- Keep it concise but complete`;

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
            content: "You are a helpful assistant that drafts professional emails. Write clear, natural email bodies.",
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
    const draft = openaiData.choices?.[0]?.message?.content?.trim() || "";

    if (!draft) {
      throw new Error("No draft generated");
    }

    console.log(`Generated ${tone} draft (${draft.length} chars)`);

    return new Response(
      JSON.stringify({
        success: true,
        draft,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error generating draft:", error);
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
