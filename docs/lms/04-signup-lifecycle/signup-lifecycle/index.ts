// track-user-signup — with the lifecycle machine attached.
//
// This is the EXISTING deployed function (version 30) plus three new side effects. It is
// still fired by the AFTER INSERT trigger on auth.users via pg_net, still single-fire,
// still gated on x-webhook-secret. Nothing about the PostHog or funnel_events behaviour
// changed; if you diff against the deployed copy, everything above `runLifecycle` is
// byte-identical on purpose, so the diff is only what is new.
//
// What is new, in order:
//   3. consent — gdpr_consents (state) + marketing_consent_log (evidence)
//   4. Resend — one contact, in LMS · New Signups, opted in to Product & Account
//   5. CRM    — POST to the CRM's lms-webhook, which fills contacts + lms_leads
//
// EVERY ONE OF THESE IS NON-FATAL. They run after the response is already determined and
// each is individually caught. A signup must not fail because an email tool is down.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createSignupContact,
  isExcluded,
  signupMonth,
  splitName,
} from "./lifecycle.ts";

const POSTHOG_HOST = "https://eu.i.posthog.com";
const POSTHOG_KEY = "phc_HIzC8JuDRoBJXjg6DI1kdt3jpSX5352AKIcoeP80d6L";

interface AuthUserRow {
  id: string;
  email?: string | null;
  created_at?: string | null;
  raw_user_meta_data?: Record<string, unknown> | null;
  raw_app_meta_data?: Record<string, unknown> | null;
}

function deriveLoginType(row: AuthUserRow): string {
  // Supabase fills raw_app_meta_data.provider with 'email', 'google', 'github', etc.
  const provider = (row.raw_app_meta_data?.provider as string | undefined)
    || (row.raw_user_meta_data?.provider as string | undefined);
  if (provider) return provider;
  return "email";
}

function pickUtmProps(row: AuthUserRow): Record<string, string | null> {
  const meta = (row.raw_user_meta_data || {}) as Record<string, unknown>;
  return {
    utm_source: (meta.utm_source as string) || null,
    utm_medium: (meta.utm_medium as string) || null,
    utm_campaign: (meta.utm_campaign as string) || null,
    utm_content: (meta.utm_content as string) || null,
    utm_term: (meta.utm_term as string) || null,
    referral_source: (meta.ss_ref as string) || null,
    invite_code: (meta.invite_code as string) || null,
  };
}

/**
 * The signup IP and user agent, if the signup flow recorded them in user metadata.
 *
 * NOT the request's own IP or user agent. This function is called by pg_net from a
 * database trigger, so the connecting address is Supabase's infrastructure and the agent
 * is pg_net's — writing those into a consent record would be recording the database as
 * the consenting party. Null is the honest answer when the browser's values were never
 * captured, and a consent row with a null IP is still valid evidence; a consent row with
 * a confidently wrong IP is worse than one with none.
 */
function consentContext(row: AuthUserRow): { ip: string | null; ua: string | null } {
  const meta = (row.raw_user_meta_data || {}) as Record<string, unknown>;
  return {
    ip: (meta.signup_ip as string) || (meta.ip_address as string) || null,
    ua: (meta.signup_user_agent as string) || (meta.user_agent as string) || null,
  };
}

/**
 * Consent state and consent evidence, written together.
 *
 * gdpr_consents is the state table and has UNIQUE (user_id, consent_type), so this is an
 * upsert — a returning user who somehow reaches signup twice updates their row rather
 * than throwing 23505 and losing the whole lifecycle block.
 *
 * consent_type is the bare noun 'product'. NOT 'product_emails': the live table holds 228
 * 'product' rows and the unique constraint is on the pair, so a second spelling would
 * create a parallel consent record for the same person rather than updating theirs.
 *
 * NO MARKETING ROW IS WRITTEN HERE, of either polarity. The absence of a row is stronger
 * evidence of non-consent than a granted=false row somebody could later argue was a
 * default. Marketing consent starts existing when someone clicks the opt-in link, and not
 * one moment sooner.
 */
async function recordProductConsent(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  createdAt: string,
  ctx: { ip: string | null; ua: string | null },
): Promise<void> {
  const { error: stateError } = await supabase
    .from("gdpr_consents")
    .upsert(
      {
        user_id: userId,
        consent_type: "product",
        granted: true,
        granted_at: createdAt,
        revoked_at: null,
        ip_address: ctx.ip,
        user_agent: ctx.ua,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,consent_type" },
    );
  if (stateError) {
    console.error("[track-user-signup] gdpr_consents upsert failed:", stateError.message);
  }

  // The append-only audit log. `action` is CHECK-constrained to four values, so this is
  // 'consent_granted'; which consent it was about is carried by consent_type, added by
  // 00-consent-log-consent-type.sql. entity_type is CHECK-constrained to profile|contact
  // — 'user' is not a legal value and would throw 23514.
  const { error: logError } = await supabase
    .from("marketing_consent_log")
    .insert({
      entity_type: "profile",
      entity_id: userId,
      action: "consent_granted",
      consent_type: "product",
      ip_address: ctx.ip,
      user_agent: ctx.ua,
    });
  if (logError) {
    console.error("[track-user-signup] marketing_consent_log insert failed:", logError.message);
  }
}

/** Hand the signup to the CRM. One direction only: LMS -> CRM -> Resend. */
async function notifyCrm(
  email: string,
  fullName: string | null,
  userId: string,
  createdAt: string,
  profile: Record<string, unknown> | null,
): Promise<void> {
  const url = Deno.env.get("CRM_LMS_WEBHOOK_URL");
  const key = Deno.env.get("CRM_WEBHOOK_API_KEY");
  const crmUserId = Deno.env.get("CRM_OWNER_USER_ID");
  if (!url || !key || !crmUserId) {
    console.warn(
      "[track-user-signup] CRM webhook not configured (need CRM_LMS_WEBHOOK_URL, " +
        "CRM_WEBHOOK_API_KEY, CRM_OWNER_USER_ID) — skipping",
    );
    return;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({
      user_id: userId,
      email,
      name: fullName,
      role: (profile?.role_type as string) ?? null,
      company_size: (profile?.company_size as string) ?? null,
      use_case: (profile?.use_case as string) ?? null,
      learning_objectives: (profile?.learning_objective as string) ?? null,
      // The CRM mirrors LMS consent, it never competes with it. Product consent is what
      // signup grants; marketing consent stays false here until the opt-in link is used.
      marketing_consent: false,
      verified: Boolean(profile?.email_verified),
      created_at: createdAt,
      plan: "free",
      crm_user_id: crmUserId,
    }),
  });

  if (!res.ok) {
    console.error(
      `[track-user-signup] CRM lms-webhook ${res.status}: ${await res.text().catch(() => "")}`,
    );
  } else {
    console.log(`[track-user-signup] CRM notified for ${userId}`);
  }
}

/**
 * The three new side effects, each isolated.
 *
 * Sequential rather than parallel: the Resend contact wants the profile row that the
 * signup flow writes, and the CRM call reuses it. Three awaits on a path nobody is
 * waiting on is the cheapest possible ordering guarantee.
 */
async function runLifecycle(record: AuthUserRow, createdAt: string): Promise<void> {
  const email = (record.email ?? "").trim().toLowerCase();
  if (!email) {
    console.warn(`[track-user-signup] no email on ${record.id} — lifecycle skipped`);
    return;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Consent is recorded for everyone, including excluded addresses. Exclusion is about
  // not mailing someone; it is not a reason to lose the record of what they agreed to.
  try {
    await recordProductConsent(supabase, record.id, createdAt, consentContext(record));
  } catch (err) {
    console.error("[track-user-signup] consent block failed:", err);
  }

  // The signup flow writes profiles slightly after the auth.users row, so this may miss.
  // A missing profile costs the `company` property, not the contact.
  let profile: Record<string, unknown> | null = null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, company_name, role_type, company_size, use_case, learning_objective, email_verified")
      .eq("id", record.id)
      .maybeSingle();
    profile = data ?? null;
  } catch (err) {
    console.error("[track-user-signup] profile read failed:", err);
  }

  const fullName = (profile?.full_name as string)
    || (record.raw_user_meta_data?.full_name as string)
    || null;

  if (isExcluded(email)) {
    console.log(`[track-user-signup] ${email} is excluded — no Resend contact, no CRM lead`);
    return;
  }

  try {
    const { firstName, lastName } = splitName(fullName);
    const result = await createSignupContact(Deno.env.get("RESEND_API_KEY")!, {
      email,
      firstName,
      lastName,
      properties: {
        company: (profile?.company_name as string) || null,
        signup_month: signupMonth(createdAt),
        lifecycle: "signup",
        // Nothing is known about what they will build yet. The course webhook fills
        // topic_cluster in; until then Resend's own fallback ('other') applies.
        topic_cluster: null,
      },
    });
    if (result.deduped) {
      console.log(`[track-user-signup] Resend contact already existed for ${email}`);
    } else if (!result.ok) {
      console.error(
        `[track-user-signup] Resend ${result.detail.status}:`,
        JSON.stringify(result.detail.body),
      );
    } else {
      console.log(`[track-user-signup] Resend contact created for ${email}`);
    }
  } catch (err) {
    console.error("[track-user-signup] Resend block failed:", err);
  }

  try {
    await notifyCrm(email, fullName, record.id, createdAt, profile);
  } catch (err) {
    console.error("[track-user-signup] CRM block failed:", err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const expected = Deno.env.get("WEBHOOK_SECRET");
  if (!expected) return new Response("not configured", { status: 500 });
  if (req.headers.get("x-webhook-secret") !== expected) {
    return new Response("forbidden", { status: 403 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }

  // Standard Supabase webhook payload: { type, table, schema, record, old_record }
  const record: AuthUserRow | undefined = payload?.record;
  if (!record?.id) {
    return new Response(JSON.stringify({ error: "missing record.id" }), { status: 400 });
  }

  const loginType = deriveLoginType(record);
  const utm = pickUtmProps(record);
  const fullName = (record.raw_user_meta_data?.full_name as string) || null;
  const createdAt = record.created_at || new Date().toISOString();

  // 1. PostHog capture — single event, identifies user via $set
  try {
    const phRes = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: "user_signed_up",
        distinct_id: record.id,
        timestamp: createdAt,
        properties: {
          login_type: loginType,
          plan: "free",
          ...utm,
          $set: {
            email: record.email,
            name: fullName,
            created_at: createdAt,
            initial_login_type: loginType,
            ...utm,
          },
        },
      }),
    });
    if (!phRes.ok) {
      console.error(`[track-user-signup] PostHog ${phRes.status}: ${await phRes.text().catch(() => "")}`);
    } else {
      console.log(`[track-user-signup] PostHog captured user_signed_up for ${record.id}`);
    }
  } catch (err) {
    // Non-fatal — funnel_events still gets the row.
    console.error("[track-user-signup] PostHog capture failed:", err);
  }

  // 2. funnel_events row for internal funnel dashboards
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase.from("funnel_events").insert({
      user_id: record.id,
      pipeline: "auth",
      step: "signup_completed",
      occurred_at: createdAt,
      properties: {
        login_type: loginType,
        plan: "free",
        ...utm,
      },
    });
    if (error) console.error("[track-user-signup] funnel_events insert failed:", error.message);
  } catch (err) {
    console.error("[track-user-signup] funnel_events exception:", err);
  }

  // 3-5. Consent, Resend, CRM. Awaited rather than floated: an edge function's runtime
  // can be torn down the moment the response is returned, which silently drops unawaited
  // work. The trigger is fire-and-forget over pg_net, so nobody is waiting on this.
  try {
    await runLifecycle(record, createdAt);
  } catch (err) {
    console.error("[track-user-signup] lifecycle failed:", err);
  }

  return new Response(JSON.stringify({ success: true, userId: record.id, loginType }), {
    headers: { "Content-Type": "application/json" },
  });
});
