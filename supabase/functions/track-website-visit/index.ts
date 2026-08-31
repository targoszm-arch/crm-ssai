// Collects page views from the marketing site (Framer) and resolves the
// visitor's IP to an organisation — the same reverse-IP technique Leadfeeder
// and Apollo use, running on our own infrastructure.
//
// Two rules drive the design:
//
//  1. It never surfaces an error to the browser. Every path returns 204, so a
//     misconfiguration, an exhausted API quota or a provider outage leaves the
//     visitor's console clean. Problems are logged here instead.
//  2. It never stores a raw IP. The address is hashed with a server-side salt
//     immediately after the lookup, which is enough to cache and de-duplicate
//     but not to re-identify an individual.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Every response the tracker ever sees.
function noContent(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

const CACHE_TTL_DAYS = 30;

interface Resolved {
  company_name: string | null;
  company_domain: string | null;
  asn: string | null;
  asn_name: string | null;
  asn_type: string | null;
  classification: "company" | "isp" | "hosting" | "bot" | "unknown";
  country: string | null;
  region: string | null;
  city: string | null;
  resolver: string;
  raw: Record<string, unknown> | null;
}

const EMPTY: Resolved = {
  company_name: null, company_domain: null, asn: null, asn_name: null,
  asn_type: null, classification: "unknown", country: null, region: null,
  city: null, resolver: "none", raw: null,
};

const BOT_UA =
  /bot|crawler|spider|crawling|slurp|bingpreview|headless|phantomjs|lighthouse|pingdom|uptime|gtmetrix|facebookexternalhit|whatsapp|telegram|preview|monitor|curl|wget|python-requests|axios|scrapy/i;

// Consumer broadband and mobile carriers dominate reverse-IP results and are
// worthless as leads. Providers that report an ASN type let us filter properly;
// this list is the fallback for providers that only give a name.
const ISP_NAME_HINTS =
  /\b(telecom|telekom|broadband|cable|mobile|wireless|cellular|comcast|verizon|vodafone|orange|telefonica|t-mobile|at&t|charter|spectrum|virgin media|sky broadband|bt group|british telecom|eir|three|deutsche telekom|swisscom|telenor|telia|kpn|proximus|liberty global|altice|free sas|sfr|bouygues|jio|airtel|claro|telstra|optus|rogers|bell canada|shaw|cox communications|centurylink|frontier|windstream|starlink|isp)\b/i;

function extractIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    null;
}

// Loopback, link-local and RFC1918 addresses never resolve to anything useful.
function isPrivateIp(ip: string): boolean {
  return /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd)/i
    .test(ip);
}

async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

// Providers occasionally return a URL or a name in the domain field; keep only
// something that actually looks like a hostname.
function cleanDomain(value: unknown): string | null {
  const raw = str(value, 253);
  if (!raw) return null;
  const host = raw.toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
}

// ── Reverse-IP providers ───────────────────────────────────────────────────

// ipapi.is is the default because it returns the organisation type directly
// (business / isp / hosting / education / government), which is what separates
// a real lead from someone's home broadband. Works without a key at a low
// daily allowance; set IPAPI_IS_KEY to raise it.
async function resolveViaIpapiIs(ip: string): Promise<Resolved | null> {
  const key = Deno.env.get("IPAPI_IS_KEY");
  const url = `https://api.ipapi.is/?q=${encodeURIComponent(ip)}` +
    (key ? `&key=${encodeURIComponent(key)}` : "");

  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) {
    console.warn(`ipapi.is returned ${res.status}`);
    return null;
  }

  const data = await res.json();
  if (data?.error) {
    console.warn(`ipapi.is error: ${data.error}`);
    return null;
  }

  // With an API key, ipapi.is nests company/asn/location objects and returns
  // an explicit organisation `type` plus `is_crawler`. Without one — the free
  // tier, which is what runs without IPAPI_IS_KEY set — it returns a flatter
  // shape instead: top-level `company_name`, `asn_num`, `asn_org`, `cc`, no
  // `type` field and no `is_crawler` at all. The two were never told apart
  // here, so every free-tier hit parsed to nulls and got silently discarded.
  const company = data.company ?? null;
  const asn = data.asn ?? null;

  const companyName = str(company?.name ?? data.company_name, 200);
  const asnName = str(asn?.org ?? asn?.descr ?? data.asn_org, 200);
  const asnNum = asn?.asn ?? data.asn_num;
  const type = String(company?.type ?? asn?.type ?? "").toLowerCase();
  const nameForIspCheck = companyName ?? asnName ?? "";

  let classification: Resolved["classification"] = "unknown";
  if (data.is_crawler === true) {
    classification = "bot";
  } else if (
    data.is_datacenter === true || data.is_vpn === true ||
    data.is_proxy === true || data.is_tor === true || type === "hosting"
  ) {
    classification = "hosting";
  } else if (type === "isp" || type === "mobile") {
    classification = "isp";
  } else if (["business", "education", "government"].includes(type)) {
    classification = "company";
  } else if (!type && nameForIspCheck) {
    // Free tier gives no `type` at all — fall back to name-based ISP
    // detection so a Comcast/Vodafone/etc. connection isn't counted as an
    // identified company just because a name came back.
    classification = ISP_NAME_HINTS.test(nameForIspCheck) ? "isp" : "company";
  }

  return {
    company_name: companyName ?? asnName,
    company_domain: cleanDomain(company?.domain),
    asn: asnNum != null ? String(asnNum) : null,
    asn_name: asnName,
    asn_type: type || null,
    classification,
    country: str(data.location?.country_code ?? data.location?.country ?? data.cc, 80),
    region: str(data.location?.state, 120),
    city: str(data.location?.city, 120),
    resolver: "ipapi_is",
    raw: {
      company,
      asn,
      is_datacenter: data.is_datacenter,
      is_crawler: data.is_crawler,
    },
  };
}

// IPinfo Lite is a free tier that returns the ASN and its domain but no
// organisation type, so ISPs have to be filtered by name.
async function resolveViaIpinfo(ip: string): Promise<Resolved | null> {
  const token = Deno.env.get("IPINFO_TOKEN");
  if (!token) return null;

  const res = await fetch(
    `https://api.ipinfo.io/lite/${encodeURIComponent(ip)}?token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(4000) },
  );
  if (!res.ok) {
    console.warn(`ipinfo returned ${res.status}`);
    return null;
  }

  const data = await res.json();
  const name = str(data.as_name, 200);
  const domain = cleanDomain(data.as_domain);

  let classification: Resolved["classification"] = "unknown";
  if (name && ISP_NAME_HINTS.test(name)) {
    classification = "isp";
  } else if (name && domain) {
    classification = "company";
  }

  return {
    company_name: name,
    company_domain: domain,
    asn: str(data.asn, 40),
    asn_name: name,
    asn_type: null,
    classification,
    country: str(data.country_code ?? data.country, 80),
    region: null,
    city: null,
    resolver: "ipinfo",
    raw: data,
  };
}

async function resolveIp(ip: string): Promise<Resolved> {
  const providers = [resolveViaIpapiIs, resolveViaIpinfo];

  for (const provider of providers) {
    try {
      const result = await provider(ip);
      // Accept an answer that named something, classified the traffic, or at
      // least located it — a geo-only hit still beats nothing, and previously
      // got discarded entirely alongside the truly empty ones.
      if (
        result &&
        (result.company_name || result.classification !== "unknown" || result.country)
      ) {
        return result;
      }
    } catch (error) {
      console.warn(`Reverse-IP provider failed: ${error}`);
    }
  }

  return EMPTY;
}

// ── Handler ────────────────────────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return noContent();

  try {
    // The tracker sends text/plain so the request stays "simple" and the
    // browser skips the CORS preflight.
    const body = await req.text();
    if (!body || body.length > 8000) return noContent();

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body);
    } catch {
      return noContent();
    }

    const siteKey = str(payload.site_key, 64);
    if (!siteKey) return noContent();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: site } = await supabase
      .from("visitor_sites")
      .select("id, user_id, allowed_origins, is_active")
      .eq("site_key", siteKey)
      .maybeSingle();

    if (!site || !site.is_active) {
      console.warn("Unknown or inactive site key");
      return noContent();
    }

    // Optional origin allow-list, so a leaked site key can't be used to inject
    // hits from somewhere else.
    const allowed: string[] = site.allowed_origins ?? [];
    if (allowed.length > 0) {
      const origin = req.headers.get("origin") || "";
      let hostname = "";
      try {
        hostname = new URL(origin).hostname.replace(/^www\./, "");
      } catch { /* no usable Origin header */ }

      const permitted = hostname && allowed.some((entry) => {
        const clean = entry.trim().toLowerCase().replace(/^www\./, "");
        return hostname === clean || hostname.endsWith(`.${clean}`);
      });

      if (!permitted) {
        console.warn(`Rejected hit from origin: ${origin || "(none)"}`);
        return noContent();
      }
    }

    const userAgent = req.headers.get("user-agent") || "";
    const ip = extractIp(req);
    const salt = Deno.env.get("VISITOR_IP_SALT") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let resolved: Resolved = { ...EMPTY };
    let ipHash: string | null = null;

    if (BOT_UA.test(userAgent)) {
      resolved = { ...EMPTY, classification: "bot", resolver: "user_agent" };
    } else if (ip && !isPrivateIp(ip)) {
      ipHash = await hashIp(ip, salt);

      // Reuse a recent lookup for this visitor before spending an API call.
      const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86400_000)
        .toISOString();
      const { data: cached } = await supabase
        .from("visitor_ip_cache")
        .select("*")
        .eq("ip_hash", ipHash)
        .gte("resolved_at", cutoff)
        .maybeSingle();

      if (cached) {
        resolved = {
          company_name: cached.company_name,
          company_domain: cached.company_domain,
          asn: cached.asn,
          asn_name: cached.asn_name,
          asn_type: cached.asn_type,
          classification: cached.classification,
          country: cached.country,
          region: cached.region,
          city: cached.city,
          resolver: "cache",
          raw: cached.raw,
        };
      } else {
        resolved = await resolveIp(ip);

        if (resolved.resolver !== "none") {
          const { error: cacheError } = await supabase
            .from("visitor_ip_cache")
            .upsert({
              ip_hash: ipHash,
              company_name: resolved.company_name,
              company_domain: resolved.company_domain,
              asn: resolved.asn,
              asn_name: resolved.asn_name,
              asn_type: resolved.asn_type,
              classification: resolved.classification,
              country: resolved.country,
              region: resolved.region,
              city: resolved.city,
              resolver: resolved.resolver,
              raw: resolved.raw,
              resolved_at: new Date().toISOString(),
            }, { onConflict: "ip_hash" });

          if (cacheError) console.warn(`Cache write failed: ${cacheError.message}`);
        }
      }
    }

    // Link the visit to an existing CRM company when the domain matches.
    let matchedCompanyId: string | null = null;
    if (resolved.classification === "company" && resolved.company_domain) {
      const domain = resolved.company_domain;
      const { data: match } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", site.user_id)
        .or(`website.ilike.%${domain}%,domains.ilike.%${domain}%`)
        .limit(1)
        .maybeSingle();

      matchedCompanyId = match?.id ?? null;
    }

    const { error: insertError } = await supabase
      .from("website_visits")
      .insert({
        site_id: site.id,
        user_id: site.user_id,
        session_id: str(payload.session_id, 64),
        path: str(payload.path, 500),
        page_title: str(payload.title, 300),
        referrer: str(payload.referrer, 500),
        utm_source: str(payload.utm_source, 120),
        utm_medium: str(payload.utm_medium, 120),
        utm_campaign: str(payload.utm_campaign, 200),
        utm_term: str(payload.utm_term, 200),
        utm_content: str(payload.utm_content, 200),
        ip_hash: ipHash,
        user_agent: userAgent.slice(0, 400) || null,
        country: resolved.country,
        region: resolved.region,
        city: resolved.city,
        company_name: resolved.company_name,
        company_domain: resolved.company_domain,
        asn: resolved.asn,
        asn_name: resolved.asn_name,
        asn_type: resolved.asn_type,
        classification: resolved.classification,
        matched_company_id: matchedCompanyId,
        resolver: resolved.resolver,
        raw: resolved.raw,
      });

    if (insertError) {
      console.error(`Failed to record visit: ${insertError.message}`);
    }

    return noContent();
  } catch (error) {
    // Deliberately swallowed: the visitor's browser must never see a failure.
    console.error("track-website-visit failed:", error);
    return noContent();
  }
});
