import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateDraftRequest {
  messageText: string;
  senderName: string;
  tone: "professional" | "casual" | "brief";
  context?: string;
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

    const { messageText, senderName, tone = "professional", context }: GenerateDraftRequest = await req.json();

    if (!messageText) {
      throw new Error("messageText is required");
    }

    console.log(`Generating ${tone} LinkedIn reply draft for message from ${senderName}`);

    const toneInstructions = {
      professional: "Write in a professional but personable LinkedIn tone. Be respectful and business-focused.",
      casual: "Write in a friendly, conversational tone appropriate for LinkedIn networking.",
      brief: "Be concise and direct. LinkedIn messages should be short and to the point.",
    };

    const prompt = `You are helping draft a LinkedIn message reply. ${toneInstructions[tone]}

ORIGINAL MESSAGE FROM ${senderName || "LinkedIn User"}:
${messageText}

${context ? `\nAdditional context: ${context}` : ""}

---
INSTRUCTIONS:
- Write a ${tone} reply to this LinkedIn message
- Keep it appropriate for LinkedIn (professional networking)
- Do NOT include greeting like "Hi [name]" - just start the message
- Do NOT include signature - just the body
- Keep it natural and human-sounding
- Be concise - LinkedIn messages should be shorter than emails`;

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
            content: "You are a helpful assistant that drafts LinkedIn message replies. Write concise, professional responses appropriate for business networking.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
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

    console.log(`Generated ${tone} LinkedIn draft (${draft.length} chars)`);

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
