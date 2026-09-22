import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScoreRequest {
  companyId: string;
  definitionIds?: string[];
}

interface AiFieldDefinition {
  id: string;
  key: string;
  label: string;
  kind: "tier" | "qualifier";
  tier_options: string[] | null;
  prompt_template: string;
}

// Fixed skeleton wrapped around every qualifier definition's Claim/QUALIFIED IF/NOT
// QUALIFIED IF text -- only the claim and the two evidence blocks vary per field.
function buildQualifierPrompt(def: AiFieldDefinition, contextBlock: string): string {
  return `TASK
You are an expert fact-checker. Evaluate whether the following claim is Qualified or Not Qualified for the given entity.

STEPS
1. Review the entity data provided in CONTEXT.
2. Look for direct evidence first; if unavailable, use strong indirect signals.
3. Qualified -- clear or high-confidence evidence supports the claim.
4. Not Qualified -- clear or high-confidence evidence contradicts the claim, or evidence is missing/ambiguous/insufficient to decide.
5. Do not infer from industry label alone. A company being in a regulated sector does not by itself satisfy this claim.

${def.prompt_template}

CONTEXT
${contextBlock}

OUTPUT
Line 1: Qualified or Not Qualified.
Line 2: the single strongest piece of evidence, quoted verbatim from the context, or "no evidence found".`;
}

// Fixed close wrapped around a tier definition's rubric text -- the rubric itself
// (ICP criteria, scoring bands, disqualifiers) is the user-configurable part.
function buildTierPrompt(def: AiFieldDefinition, contextBlock: string, today: string): string {
  const options = (def.tier_options || []).join(", ");
  return `${def.prompt_template}

FINAL OUTPUT REQUIREMENT:
Start your response with exactly one of these labels, spelled exactly as shown, and nothing before it: ${options}.
After the label, write 1-2 concise paragraphs justifying the score using the account data below and, where the rubric calls for it, naming the change signals found.

ACCOUNT DATA:
${contextBlock}

Today's date: ${today}`;
}

function buildContextBlock(company: Record<string, unknown>): string {
  const lines: string[] = [];
  const put = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return;
    lines.push(`${label}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
  };
  put("Company name", company.company_name);
  put("Website", company.website || company.domains);
  put("Description", company.description);
  put("Primary industry", company.industry);
  put("Categories / secondary signals", company.categories);
  put("Employee count", company.employee_count);
  put("Employee range", company.employee_range);
  put("Annual revenue (USD)", company.annual_turnover);
  put("Estimated ARR (USD)", company.estimated_arr);
  put("Total funding raised (USD)", company.funding_raised);
  put("Founded", company.foundation_date);
  put("HQ country", company.country);
  put("Address", company.address);
  put("LinkedIn", company.linkedin_url);
  put("NAICS", company.naics_code ? `${company.naics_code} -- ${company.naics_description}` : null);
  put("SIC", company.sic_code ? `${company.sic_code} -- ${company.sic_title}` : null);
  put("Labels", company.labels);
  const customFields = company.custom_fields as Record<string, unknown> | null;
  if (customFields && Object.keys(customFields).length > 0) {
    put("Other recorded signals", customFields);
  }
  if (lines.length === 0) return "No usable data on this account -- no website, description or employee count recorded.";
  return lines.join("\n");
}

function parseTierResponse(text: string, options: string[]): { value: string | null; evidence: string } {
  const trimmed = text.trim();
  const firstLine = trimmed.split("\n")[0];
  const match = options.find((o) => firstLine.toLowerCase().includes(o.toLowerCase()));
  if (!match) return { value: null, evidence: trimmed };
  // Evidence is everything after the matched label, trimming a leading colon/dash.
  const idx = trimmed.toLowerCase().indexOf(match.toLowerCase());
  const rest = trimmed.slice(idx + match.length).replace(/^[\s:.\-–—]+/, "").trim();
  return { value: match, evidence: rest || trimmed };
}

function parseQualifierResponse(text: string): { value: string | null; evidence: string } {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const firstLine = (lines[0] || "").toLowerCase();
  let value: string | null = null;
  if (firstLine.includes("not qualified")) value = "Not Qualified";
  else if (firstLine.includes("qualified")) value = "Qualified";
  const evidence = lines.slice(1).join(" ").trim() || "no evidence found";
  return { value, evidence };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
    if (!openaiApiKey) throw new Error("OPENAI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { companyId, definitionIds }: ScoreRequest = await req.json();
    if (!companyId) throw new Error("companyId is required");

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .eq("user_id", user.id)
      .single();

    if (companyError || !company) {
      throw new Error(`Company not found: ${companyError?.message}`);
    }

    let defsQuery = supabase
      .from("ai_field_definitions")
      .select("id, key, label, kind, tier_options, prompt_template")
      .eq("user_id", user.id)
      .eq("entity_type", "company")
      .eq("active", true);

    if (definitionIds && definitionIds.length > 0) {
      defsQuery = defsQuery.in("id", definitionIds);
    }

    const { data: definitions, error: defsError } = await defsQuery;
    if (defsError) throw new Error(`Failed to load AI field definitions: ${defsError.message}`);
    if (!definitions || definitions.length === 0) {
      return new Response(JSON.stringify({ success: true, results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contextBlock = buildContextBlock(company);
    const today = new Date().toISOString().split("T")[0];
    const model = "gpt-4o-mini";

    const results: Array<{ definitionId: string; key: string; label: string; value: string | null; evidence: string }> = [];

    for (const def of definitions as AiFieldDefinition[]) {
      const prompt = def.kind === "tier"
        ? buildTierPrompt(def, contextBlock, today)
        : buildQualifierPrompt(def, contextBlock);

      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You follow scoring instructions exactly and never invent facts not present in the supplied account data." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 400,
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.log(`OpenAI error for ${def.key}:`, errorText);
        continue;
      }

      const openaiData = await openaiResponse.json();
      const text: string | undefined = openaiData.choices?.[0]?.message?.content;
      if (!text) continue;

      const parsed = def.kind === "tier"
        ? parseTierResponse(text, def.tier_options || [])
        : parseQualifierResponse(text);

      const { error: upsertError } = await supabase
        .from("ai_field_values")
        .upsert(
          {
            ai_field_definition_id: def.id,
            company_id: companyId,
            user_id: user.id,
            value: parsed.value,
            evidence: parsed.evidence,
            model,
            computed_at: new Date().toISOString(),
          },
          { onConflict: "ai_field_definition_id,company_id" }
        );

      if (upsertError) {
        console.log(`Failed to save result for ${def.key}:`, upsertError.message);
        continue;
      }

      results.push({ definitionId: def.id, key: def.key, label: def.label, value: parsed.value, evidence: parsed.evidence });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.log("Error scoring AI fields:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
