// Shared by both lifecycle webhooks. Everything here is deliberately side-effect-free
// about signup itself: every function returns a result, none of them throw into the
// caller's critical path. A signup must not fail because an email tool is down.

export const SEGMENTS = {
  newSignups: "cfc3d2ea-9347-4f87-8696-41183119392f",
  dormantBuilders: "d489cf13-8497-4226-a90d-4d22701b7303",
  dormantNeverBuilt: "3a27fd6d-d6e1-44f5-8467-0645baf7e4d9",
} as const;

export const TOPICS = {
  // Default opt-in: service mail about the customer's own account.
  productAndAccount: "858b0751-dbd4-4d5a-b995-b6596657dddb",
  // Default opt-out. Never written at signup — it fills only from the explicit opt-in
  // link in email 4, and the point of it is that it is empty until someone asks.
  complianceTrainingNote: "cfa87668-52b3-4422-8ec2-0a2aab49a02c",
} as const;

const RESEND_API = "https://api.resend.com";

// Addresses that must never become a Resend contact. Suppression is the wrong tool here:
// it is account-wide, so suppressing a colleague or a test rig would also block the
// product mail their account legitimately needs. Not creating the contact costs nothing.
const EXCLUDED_DOMAINS = new Set([
  "skillstudio.ai",
  "skillstudio-test.com",
  // Disposable mail. These sign up, never return, and drag the sending reputation down.
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "sharklasers.com",
  "trashmail.com",
  "getnada.com",
  "maildrop.cc",
  "dispostable.com",
  "fakeinbox.com",
  "mintemail.com",
]);

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

/**
 * True when this address should never reach Resend at all.
 *
 * Checked at the function rather than only in Resend, so the contact is never created in
 * the first place — a suppressed contact is still a contact, still counts, still shows up
 * in a segment's size, and still has to be explained.
 */
export function isExcluded(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return true;
  if (EXCLUDED_DOMAINS.has(domain)) return true;
  // Gmail's +tag trick is how the same person signs up twenty times in testing.
  if (/^.+\+.*@gmail\.com$/i.test(email.trim())) return true;
  return false;
}

/** `2026-09` — the property is typed string in Resend, so it stays a string here. */
export function signupMonth(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function splitName(full: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export interface ResendResult {
  ok: boolean;
  status: number;
  body: unknown;
}

async function resendFetch(
  apiKey: string,
  path: string,
  init: RequestInit,
): Promise<ResendResult> {
  const res = await fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // A 204 has no body; that is not a failure.
  }
  return { ok: res.ok, status: res.status, body };
}

export type TopicCluster =
  | "ai-governance"
  | "cybersecurity"
  | "safety-ops"
  | "clinical-regulated"
  | "other";

export interface ContactProperties {
  company?: string | null;
  course_title?: string | null;
  module_count?: number | null;
  video_count?: number | null;
  signup_month?: string | null;
  topic_cluster?: TopicCluster | null;
  lifecycle?: "signup" | "builder" | null;
}

/**
 * Drops keys whose value is null or undefined.
 *
 * Resend treats an explicit null as "clear this property", so passing the whole shape
 * through on a partial update would wipe `company` every time a course is built.
 * `module_count` and `video_count` are typed `number` in Resend and 0 is a real value,
 * so only null and undefined are dropped, never falsy.
 */
function definedOnly(props: ContactProperties): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(props).filter(([, v]) => v !== null && v !== undefined),
  ) as Record<string, string | number>;
}

/**
 * Create the signup contact, put it in a segment and set its topics in ONE call.
 *
 * Resend's POST /contacts accepts segmentIds and topics inline, so the three things the
 * spec asks for are one request, not three — which also means they cannot half-apply and
 * leave a contact in no segment.
 *
 * Dedupe: a re-signup on the same address must not make a second contact. Resend answers
 * a duplicate create with 409, which is a success for our purposes — the contact exists,
 * which is all we wanted — so it is reported as `deduped` rather than as an error.
 */
export async function createSignupContact(
  apiKey: string,
  input: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    properties: ContactProperties;
  },
): Promise<{ ok: boolean; deduped: boolean; detail: ResendResult }> {
  const result = await resendFetch(apiKey, "/contacts", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      ...(input.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName ? { lastName: input.lastName } : {}),
      properties: definedOnly(input.properties),
      segmentIds: [SEGMENTS.newSignups],
      // Product & Account only. Compliance Training Note is opt-out by default and is
      // deliberately absent: writing it here, even as opt_out, would mean this function
      // has an opinion about a consent nobody has given.
      topics: [{ id: TOPICS.productAndAccount, subscription: "opt_in" }],
    }),
  });

  if (result.status === 409) {
    return { ok: true, deduped: true, detail: result };
  }
  return { ok: result.ok, deduped: false, detail: result };
}

/**
 * Patch an existing contact's properties by email.
 *
 * Used by the course webhook, which knows the address but not the Resend contact id.
 */
export async function updateContactProperties(
  apiKey: string,
  email: string,
  properties: ContactProperties,
): Promise<ResendResult> {
  return await resendFetch(apiKey, `/contacts/${encodeURIComponent(email)}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: definedOnly(properties) }),
  });
}

/**
 * Classify a course into the cluster that routes the proof link in the sequence.
 *
 * Ordered, not scored, and the order is the point: a course about securing clinical
 * records is a cybersecurity course before it is a clinical one, because the proof link
 * that lands is about the thing the course teaches, not the industry it is set in.
 * `other` is a real answer, not a failure — roughly half of courses are genuinely general.
 */
export function classifyTopicCluster(
  title: string | null | undefined,
  description?: string | null,
): TopicCluster {
  const text = `${title ?? ""} ${description ?? ""}`.toLowerCase();
  if (!text.trim()) return "other";

  const matches = (words: string[]) => words.some((w) => text.includes(w));

  if (
    matches([
      "ai governance", "ai act", "eu ai act", "responsible ai", "ai policy",
      "ai risk", "algorithmic", "model risk", "ai ethics", "iso 42001",
    ])
  ) return "ai-governance";

  if (
    matches([
      "cyber", "security", "infosec", "phishing", "ransomware", "gdpr",
      "data protection", "privacy", "iso 27001", "nis2", "breach", "password",
    ])
  ) return "cybersecurity";

  if (
    matches([
      "safety", "health and safety", "hse", "manual handling", "fire",
      "ppe", "hazard", "risk assessment", "first aid", "lockout", "forklift",
      "working at height", "coshh",
    ])
  ) return "safety-ops";

  if (
    matches([
      "clinical", "patient", "medical", "gmp", "gxp", "pharma", "hipaa",
      "nurse", "healthcare", "medication", "infection control", "safeguarding",
    ])
  ) return "clinical-regulated";

  return "other";
}
