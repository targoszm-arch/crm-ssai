// Marketing consent confirmation — deploy to the LMS project (oxlujbymtjugefaqmwuy)
// as `confirm-marketing-consent`, with verify_jwt = false (it is clicked from an email,
// so there is no session).
//
// This is the one endpoint behind three different links:
//   * Email 4 of the Finish Line sequence — the explicit marketing opt-in
//   * ?action=unsubscribe — revoking marketing consent
//   * the abandoned-signup footer, which today points at a static /unsubscribe page
//     that records nothing
//
// The token columns already exist on profiles (consent_verification_token,
// consent_verification_expires_at, marketing_consent_verified_at, marketing_consent_ip).
// This function is what finally writes to them.
//
//   GET /confirm-marketing-consent?token=<signed token>
//   GET /confirm-marketing-consent?token=<signed token>&action=unsubscribe

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = "https://training.skillstudio.ai";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;

function page(title: string, message: string, status = 200): Response {
  // Plain, self-contained confirmation page. No tracking on a consent screen.
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Skill Studio AI</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f4">
<div style="max-width:520px;margin:64px auto;padding:40px 32px;background:#fff;border-radius:8px;text-align:center">
<h1 style="margin:0 0 12px;font-size:22px;color:#1a1a1a">${esc(title)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#333">${esc(message)}</p>
<a href="${SITE}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;
border-radius:8px;text-decoration:none;font-weight:600">Back to Skill Studio AI</a>
</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const revoking = url.searchParams.get("action") === "unsubscribe";

    if (!token || !TOKEN_PATTERN.test(token)) {
      return page("That link didn't work", "The confirmation link is missing or malformed. Use the link in the original email, or reply to it and we'll sort it out.", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, consent_verification_expires_at, marketing_emails_consent")
      .eq("consent_verification_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!profile) {
      return page("That link didn't work", "We couldn't match this link to an account. It may already have been used. Reply to the email and we'll confirm it by hand.", 404);
    }

    const expiresAt = profile.consent_verification_expires_at;
    if (!revoking && expiresAt && new Date(expiresAt) < new Date()) {
      return page("That link has expired", "Confirmation links are valid for a limited time. Reply to the email and we'll send you a fresh one.", 410);
    }

    const now = new Date().toISOString();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = req.headers.get("user-agent") ?? null;

    // 1. Profile — the flag the product reads.
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        marketing_emails_consent: !revoking,
        marketing_consent_verified_at: revoking ? null : now,
        marketing_consent_ip: revoking ? null : ip,
        consent_verification_token: null,        // single use, either way
        consent_verification_expires_at: null,
      })
      .eq("id", profile.id);
    if (profileError) throw profileError;

    // 2. gdpr_consents — the state table. Revoking keeps the row and stamps revoked_at,
    //    because a revocation you cannot evidence is as bad as no consent record at all.
    const { data: existing } = await supabase
      .from("gdpr_consents")
      .select("id")
      .eq("user_id", profile.id)
      .eq("consent_type", "marketing_emails")
      .maybeSingle();

    const consentRow = revoking
      ? { granted: false, revoked_at: now, ip_address: ip, user_agent: userAgent }
      : { granted: true, granted_at: now, revoked_at: null, ip_address: ip, user_agent: userAgent };

    if (existing) {
      const { error: e } = await supabase.from("gdpr_consents").update(consentRow).eq("id", existing.id);
      if (e) throw e;
    } else {
      const { error: e } = await supabase.from("gdpr_consents").insert({
        user_id: profile.id,
        consent_type: "marketing_emails",
        ...consentRow,
      });
      if (e) throw e;
    }

    // 3. marketing_consent_log — append-only audit. token_used is what proves consent later.
    const { error: logError } = await supabase.from("marketing_consent_log").insert({
      entity_type: "profile",
      entity_id: profile.id,
      action: revoking ? "marketing_emails_revoked" : "marketing_emails_granted",
      ip_address: ip,
      user_agent: userAgent,
      token_used: token,
    });
    if (logError) throw logError;

    return revoking
      ? page("You're unsubscribed", "You won't get marketing email from us again. You'll still get service email about your own account and the courses you've built.")
      : page("You're on the list", "Thanks — that's confirmed. You'll hear from us when we have something genuinely useful, and you can unsubscribe from any email.");
  } catch (err) {
    console.error("confirm-marketing-consent failed:", err);
    return page("Something went wrong", "We couldn't record your choice just now. Reply to the email and we'll do it by hand.", 500);
  }
});
