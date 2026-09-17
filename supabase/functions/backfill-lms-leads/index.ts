// One-off (and safely re-runnable) backfill of LMS people into the CRM.
//
// Until now LMS customers only ever reached the UI through fetch-lms-customers, which is a
// live read-through: displayed, never stored. That is why lms_leads has 0 rows and why none
// of those people could be labelled, segmented or enrolled. lms-webhook would store them,
// but it has never fired, and it only ever covers signups that happen after it is wired.
//
// This walks the same documented LMS endpoint and writes what it finds.
//
//   GET ?apply=false  (default) -> reports exactly what it WOULD do, writes nothing
//   GET ?apply=true             -> performs the writes
//
// Deliberately NOT cached: whether someone is a paying customer. That lives in the LMS
// (profiles.stripe_subscription_id) and churns. Copying it here would create precisely the
// stale hand-maintained list the "customer exclusion is a query" rule exists to prevent —
// so enrolment must still ask the LMS at the time it enrols.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LMS_ENDPOINT =
  "https://oxlujbymtjugefaqmwuy.supabase.co/functions/v1/crm-customers";

interface LmsCustomer {
  user_id?: string;
  email?: string | null;
  full_name?: string | null;
  signup_type?: string | null;
  role_type?: string | null;
  company_size?: string | null;
  use_case?: string | null;
  learning_objective?: string | null;
  marketing_emails_consent?: boolean | null;
  email_verified?: boolean | null;
  created_at?: string | null;
  total_credits?: number | null;
  used_credits?: number | null;
  billing_plan?: string | null;
  status?: string | null;
}

// "Ada Lovelace" -> { first: "Ada", last: "Lovelace" }. contacts.first_name is NOT NULL,
// so a person with no name still needs something; the email local part is a better guess
// than a literal blank.
function splitName(fullName: string | null | undefined, email: string): {
  first: string;
  last: string | null;
} {
  const name = (fullName ?? "").trim();
  if (name) {
    const parts = name.split(/\s+/);
    return {
      first: parts[0],
      last: parts.length > 1 ? parts.slice(1).join(" ") : null,
    };
  }
  const local = email.split("@")[0] ?? "";
  const derived = local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { first: derived || email, last: null };
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

    // A valid session is not authorisation. This imports every LMS customer and stores them
    // under the caller's user_id, so any account created through public sign-up could pull
    // the whole customer list and then read it back through its own RLS policies.
    // BACKFILL_OWNER_IDS is a comma-separated allow-list of auth user ids.
    const allowed = (Deno.env.get("BACKFILL_OWNER_IDS") ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    if (allowed.length === 0) {
      return json({
        error: "BACKFILL_OWNER_IDS not configured",
        detail: "Set it to the auth user id(s) permitted to run the backfill.",
      }, 500);
    }
    if (!allowed.includes(user.id)) {
      return json({ error: "Forbidden" }, 403);
    }

    const apiKey = Deno.env.get("CRM_WEBHOOK_API_KEY");
    if (!apiKey) return json({ error: "CRM_WEBHOOK_API_KEY not configured" }, 500);

    const apply = new URL(req.url).searchParams.get("apply") === "true";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Pull everyone the LMS knows about ──────────────────────────────────
    // Page until a short page comes back. One limit=1000 request would silently import the
    // first page only and still report success, leaving every later customer missing.
    const PAGE = 500;
    const customers: LmsCustomer[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const lmsUrl = new URL(LMS_ENDPOINT);
      lmsUrl.searchParams.set("limit", String(PAGE));
      lmsUrl.searchParams.set("offset", String(offset));

      const res = await fetch(lmsUrl.toString(), {
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const text = await res.text();
        return json(
          { error: "LMS endpoint failed", status: res.status, offset, details: text.slice(0, 400) },
          502,
        );
      }
      const payload = await res.json();
      const page: LmsCustomer[] = Array.isArray(payload)
        ? payload
        : payload?.customers ?? payload?.data ?? [];

      customers.push(...page);
      if (page.length < PAGE) break;
      // Guard against an endpoint that ignores offset and returns the same full page.
      if (offset > 50_000) break;
    }

    const report = {
      apply,
      lms_customers: customers.length,
      skipped_no_email: 0,
      contacts_created: 0,
      contacts_matched: 0,
      lms_leads_created: 0,
      lms_leads_updated: 0,
      marketing_consented: 0,
      errors: [] as string[],
    };

    // ── Look everything up first, in two queries ─────────────────────────
    //
    // This loop used to do FOUR sequential round-trips per customer — find the
    // contact, write it, find the lead, write it. At 252 customers that is
    // ~1,000 serial queries and the button took thirty seconds, which reads as
    // a hang rather than as work.
    //
    // Two lookups now, then chunked writes. Matching still happens per row and
    // the rules below are unchanged; only the number of network trips is.
    const rows = customers
      .map(c => ({ c, email: (c.email ?? "").trim().toLowerCase() }))
      .filter(({ email }) => {
        if (!email) { report.skipped_no_email++; return false; }
        return true;
      });
    /**
     * Every row this owner has, paged, matched in memory.
     *
     * NOT `.in("email", emails)`: that is case-SENSITIVE, where the per-row
     * lookup it replaces used `ilike`. A contact stored as "John@X.com" would
     * silently fail to match "john@x.com" and the backfill would insert a
     * duplicate of someone it already had. Reading the column and lowercasing
     * on both sides keeps the old matching exactly, and 2,837 rows of four
     * small fields is a handful of queries, not a thousand.
     */
    async function lookup<T>(table: string, select: string): Promise<T[]> {
      const out: T[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from(table)
          .select(select)
          .eq("user_id", user.id)
          .not("email", "is", null)
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        out.push(...((data ?? []) as T[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    }

    // Lower-cased on both sides, matching the ilike this replaces: contacts
    // holds addresses in whatever case they arrived in.
    const contactRows = await lookup<{ id: string; email: string | null; marketing_status: string | null; source: string | null }>(
      "contacts", "id, email, marketing_status, source",
    );
    const contactByEmail = new Map(
      contactRows.filter(r => r.email).map(r => [r.email!.trim().toLowerCase(), r]),
    );
    const leadRows = await lookup<{ id: string; email: string | null }>("lms_leads", "id, email");
    const leadByEmail = new Map(
      leadRows.filter(r => r.email).map(r => [r.email!.trim().toLowerCase(), r]),
    );

    const contactInserts: Record<string, unknown>[] = [];
    const contactUpdates: { id: string; patch: Record<string, unknown> }[] = [];
    const leadInserts: Record<string, unknown>[] = [];
    const leadUpdates: { id: string; row: Record<string, unknown> }[] = [];
    // Email -> contact id, filled in after the inserts come back.
    const resolvedContactId = new Map<string, string>();

    for (const { c, email } of rows) {
      const consented = c.marketing_emails_consent === true;
      if (consented) report.marketing_consented++;

      const existing = contactByEmail.get(email);
      if (existing) {
        report.contacts_matched++;
        resolvedContactId.set(email, existing.id);
        if (apply) {
          // Only fill gaps. An existing marketing_status was set by a human or by another
          // system and must not be silently rewritten by a backfill — least of all
          // upgraded to Subscribed.
          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (!existing.source) patch.source = "lms";
          if (!existing.marketing_status) {
            patch.marketing_status = consented ? "Subscribed" : "No consent";
          }
          contactUpdates.push({ id: existing.id, patch });
        }
      } else {
        report.contacts_created++;
        if (apply) {
          const { first, last } = splitName(c.full_name, email);
          contactInserts.push({
            user_id: user.id,
            first_name: first,
            last_name: last,
            name: c.full_name?.trim() || `${first}${last ? " " + last : ""}`,
            email,
            title: c.role_type ?? null,
            source: "lms",
            // Absence of consent is never recorded as a granted-false anything; it is
            // simply "No consent", which is what the CRM's own vocabulary calls it.
            marketing_status: consented ? "Subscribed" : "No consent",
          });
        }
      }
    }

    /** Writes in chunks, collecting per-chunk errors rather than failing the run. */
    async function chunked<T>(items: T[], size: number, fn: (batch: T[]) => Promise<void>) {
      for (let i = 0; i < items.length; i += size) {
        try { await fn(items.slice(i, i + size)); }
        catch (e) { report.errors.push(String(e)); }
      }
    }

    if (apply) {
      await chunked(contactInserts, 200, async batch => {
        const { data, error } = await supabase.from("contacts").insert(batch).select("id, email");
        if (error) throw new Error(`contact insert: ${error.message}`);
        for (const row of data ?? []) {
          if (row.email) resolvedContactId.set(row.email.trim().toLowerCase(), row.id);
        }
      });

      // Updates differ per row, so they cannot be one statement — but they can
      // at least run concurrently instead of one after another.
      await chunked(contactUpdates, 25, async batch => {
        const results = await Promise.all(batch.map(u =>
          supabase.from("contacts").update(u.patch).eq("id", u.id),
        ));
        for (const r of results) if (r.error) report.errors.push(`contact update: ${r.error.message}`);
      });
    }

    // ── lms_leads ─────────────────────────────────────────────────────────
    for (const { c, email } of rows) {
      const leadRow = {
        user_id: user.id,
        lms_user_id: c.user_id ?? null,
        full_name: c.full_name?.trim() || splitName(c.full_name, email).first,
        email,
        role: c.role_type ?? c.signup_type ?? null,
        company_size: c.company_size ?? null,
        use_case: c.use_case ?? null,
        learning_objectives: c.learning_objective ?? null,
        marketing_consent: c.marketing_emails_consent ?? null,
        verified: c.email_verified ?? null,
        plan: c.billing_plan ?? null,
        credits_used: c.used_credits ?? null,
        credits_total: c.total_credits ?? null,
        lms_created_at: c.created_at ?? null,
        contact_id: resolvedContactId.get(email) ?? null,
        source: "backfill",
        raw_payload: c as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      };

      const existingLead = leadByEmail.get(email);
      if (existingLead) {
        report.lms_leads_updated++;
        if (apply) leadUpdates.push({ id: existingLead.id, row: leadRow });
      } else {
        report.lms_leads_created++;
        if (apply) leadInserts.push(leadRow);
      }
    }

    if (apply) {
      await chunked(leadInserts, 200, async batch => {
        const { error } = await supabase.from("lms_leads").insert(batch);
        if (error) throw new Error(`lead insert: ${error.message}`);
      });
      await chunked(leadUpdates, 25, async batch => {
        const results = await Promise.all(batch.map(u =>
          supabase.from("lms_leads").update(u.row).eq("id", u.id),
        ));
        for (const r of results) if (r.error) report.errors.push(`lead update: ${r.error.message}`);
      });
    }

    return json({
      ...report,
      note: apply
        ? "Applied."
        : "Dry run — nothing was written. Re-run with ?apply=true to perform these writes.",
      reminder:
        "marketing_consent_verified_at is null for every LMS profile, so a Subscribed status " +
        "here means consent was given but never confirmed. Paying-customer status is not " +
        "stored: query the LMS at enrolment time.",
    });
  } catch (err) {
    console.error("backfill-lms-leads failed:", err);
    return json({ error: "Backfill failed", details: String(err) }, 500);
  }
});
