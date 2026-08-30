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

    for (const c of customers) {
      const email = (c.email ?? "").trim().toLowerCase();
      if (!email) {
        report.skipped_no_email++;
        continue;
      }

      const consented = c.marketing_emails_consent === true;
      if (consented) report.marketing_consented++;

      // ── Contact ─────────────────────────────────────────────────────────
      // Match on email so an LMS signup who is already a Meet Alfred contact is not
      // duplicated. contacts has no unique index on email, so this is an explicit lookup.
      // Scoped to this owner: the service role bypasses RLS, so an unscoped lookup could
      // match — and then modify — another tenant's contact with the same address.
      // Escaped, because ilike treats _ and % as wildcards and real addresses contain _:
      // "john_doe@x.com" would otherwise match "johnXdoe@x.com".
      const emailPattern = email.replace(/([\\%_])/g, "\\$1");
      const { data: existing } = await supabase
        .from("contacts")
        .select("id, marketing_status, source")
        .eq("user_id", user.id)
        .ilike("email", emailPattern)
        .limit(1)
        .maybeSingle();

      let contactId = existing?.id ?? null;

      if (contactId) {
        report.contacts_matched++;
        if (apply) {
          // Only fill gaps. An existing marketing_status was set by a human or by another
          // system and must not be silently rewritten by a backfill — least of all
          // upgraded to Subscribed.
          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (!existing?.source) patch.source = "lms";
          if (!existing?.marketing_status) {
            patch.marketing_status = consented ? "Subscribed" : "No consent";
          }
          const { error } = await supabase.from("contacts").update(patch).eq("id", contactId);
          if (error) report.errors.push(`contact update ${email}: ${error.message}`);
        }
      } else {
        report.contacts_created++;
        if (apply) {
          const { first, last } = splitName(c.full_name, email);
          const { data: created, error } = await supabase
            .from("contacts")
            .insert({
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
            })
            .select("id")
            .single();
          if (error) {
            report.errors.push(`contact insert ${email}: ${error.message}`);
            continue;
          }
          contactId = created.id;
        }
      }

      // ── lms_leads ───────────────────────────────────────────────────────
      const { data: existingLead } = await supabase
        .from("lms_leads")
        .select("id")
        .eq("user_id", user.id)
        .eq("email", email)
        .limit(1)
        .maybeSingle();

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
        contact_id: contactId,
        source: "backfill",
        raw_payload: c as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      };

      if (existingLead) {
        report.lms_leads_updated++;
        if (apply) {
          const { error } = await supabase
            .from("lms_leads").update(leadRow).eq("id", existingLead.id);
          if (error) report.errors.push(`lead update ${email}: ${error.message}`);
        }
      } else {
        report.lms_leads_created++;
        if (apply) {
          const { error } = await supabase.from("lms_leads").insert(leadRow);
          if (error) report.errors.push(`lead insert ${email}: ${error.message}`);
        }
      }
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
