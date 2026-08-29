// Exports everything worth keeping out of Apollo before the subscription is cancelled:
// every sequence with its steps and email copy, and every saved contact.
//
// Runs in the CRM project because APOLLO_API_KEY already lives here (see sync-leads-apollo).
//
//   GET ?what=sequences   -> sequences, steps, and resolved email bodies
//   GET ?what=contacts    -> all saved contacts (paged)
//   GET ?what=all         -> both (default)
//
// Read-only. Nothing is written to Apollo or to the CRM database — the response is the export.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APOLLO = "https://api.apollo.io/api/v1";
const PAGE_SIZE = 100;
const DELAY_MS = 250; // Apollo rate-limits; stay well under it

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function apollo(
  apiKey: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<any> {
  const res = await fetch(`${APOLLO}${path}`, {
    method: init.method || "GET",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo ${init.method || "GET"} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// Apollo nests the copy differently depending on the endpoint and plan, so rather than
// assume one shape we walk the object and collect anything that looks like an email body.
function harvestCopy(node: unknown, found: Array<Record<string, unknown>>, depth = 0): void {
  if (!node || typeof node !== "object" || depth > 6) return;
  if (Array.isArray(node)) {
    for (const item of node) harvestCopy(item, found, depth + 1);
    return;
  }
  const obj = node as Record<string, unknown>;
  const body = obj.body_html ?? obj.body_text ?? obj.html_body ?? obj.body;
  const subject = obj.subject ?? obj.subject_line;
  if (typeof body === "string" && body.trim()) {
    found.push({
      id: obj.id ?? null,
      name: obj.name ?? null,
      subject: typeof subject === "string" ? subject : null,
      body,
    });
  }
  for (const value of Object.values(obj)) harvestCopy(value, found, depth + 1);
}

async function exportSequences(apiKey: string) {
  const sequences: Array<Record<string, unknown>> = [];
  let page = 1;

  while (true) {
    const data = await apollo(apiKey, "/emailer_campaigns/search", {
      method: "POST",
      body: { page: String(page), per_page: String(PAGE_SIZE) },
    });
    const batch = data?.emailer_campaigns ?? [];
    sequences.push(...batch);
    const totalPages = data?.pagination?.total_pages ?? 1;
    if (page >= totalPages || batch.length === 0) break;
    page++;
    await sleep(DELAY_MS);
  }

  const exported = [];
  for (const seq of sequences) {
    const id = seq.id as string;
    const record: Record<string, unknown> = {
      id,
      name: seq.name ?? "(untitled)",
      active: seq.active,
      archived: seq.archived,
      created_at: seq.created_at,
      num_steps: seq.num_steps,
      stats: {
        unique_delivered: seq.unique_delivered,
        unique_opened: seq.unique_opened,
        unique_clicked: seq.unique_clicked,
        unique_replied: seq.unique_replied,
        unique_bounced: seq.unique_bounced,
        unique_unsubscribed: seq.unique_unsubscribed,
      },
      steps: (seq.emailer_steps as unknown[]) ?? [],
      copy: [] as Array<Record<string, unknown>>,
      copy_source: "none",
    };

    // The search response carries step timing but not the bodies. The detail endpoint
    // usually does; if this account's plan doesn't expose it, we still keep the skeleton
    // and say so rather than returning a silently empty export.
    try {
      const detail = await apollo(apiKey, `/emailer_campaigns/${id}`);
      const found: Array<Record<string, unknown>> = [];
      harvestCopy(detail, found);
      if (found.length) {
        record.copy = found;
        record.copy_source = "emailer_campaigns/:id";
      }
    } catch (err) {
      record.copy_error = String(err);
    }
    await sleep(DELAY_MS);

    // Fallback: resolve each step's touch individually.
    if ((record.copy as unknown[]).length === 0) {
      const found: Array<Record<string, unknown>> = [];
      for (const step of record.steps as Array<Record<string, unknown>>) {
        const touchIds = [step.id, ...((step.emailer_touch_ids as string[]) ?? [])].filter(Boolean);
        for (const touchId of touchIds) {
          try {
            const touch = await apollo(apiKey, `/emailer_touches/${touchId}`);
            harvestCopy(touch, found);
          } catch {
            // Expected for non-email steps (calls, LinkedIn tasks) and unsupported plans.
          }
          await sleep(DELAY_MS);
        }
      }
      if (found.length) {
        record.copy = found;
        record.copy_source = "emailer_touches/:id";
      }
    }

    exported.push(record);
  }

  return exported;
}

async function exportContacts(apiKey: string) {
  const contacts: Array<Record<string, unknown>> = [];
  let page = 1;

  while (true) {
    const data = await apollo(apiKey, "/contacts/search", {
      method: "POST",
      body: { page, per_page: PAGE_SIZE },
    });
    const batch = data?.contacts ?? [];
    for (const c of batch) {
      contacts.push({
        apollo_id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        name: c.name,
        title: c.title,
        email: c.email,
        email_status: c.email_status,
        phone: (c.phone_numbers as Array<{ sanitized_number?: string }>)?.[0]?.sanitized_number ?? null,
        linkedin_url: c.linkedin_url,
        organization_name: c.organization_name ?? (c.organization as { name?: string })?.name ?? null,
        organization_website: (c.organization as { website_url?: string })?.website_url ?? null,
        label_ids: c.label_ids,
        sequence_ids: c.emailer_campaign_ids,
        source: c.source,
        created_at: c.created_at,
        last_activity_date: c.last_activity_date,
      });
    }
    const totalPages = data?.pagination?.total_pages ?? 1;
    if (page >= totalPages || batch.length === 0) break;
    page++;
    await sleep(DELAY_MS);
  }

  return contacts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body, null, 2), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const apiKey = Deno.env.get("APOLLO_API_KEY");
    if (!apiKey) return json({ error: "APOLLO_API_KEY not configured" }, 500);

    const what = new URL(req.url).searchParams.get("what") ?? "all";
    const result: Record<string, unknown> = { exported_at: new Date().toISOString() };

    if (what === "sequences" || what === "all") {
      const sequences = await exportSequences(apiKey);
      result.sequences = sequences;
      result.sequences_count = sequences.length;
      result.sequences_with_copy = sequences.filter(
        (s) => (s.copy as unknown[]).length > 0,
      ).length;
    }

    if (what === "contacts" || what === "all") {
      const contacts = await exportContacts(apiKey);
      result.contacts = contacts;
      result.contacts_count = contacts.length;
    }

    return json(result);
  } catch (err) {
    console.error("export-apollo failed:", err);
    return json({ error: "Export failed", details: String(err) }, 500);
  }
});
