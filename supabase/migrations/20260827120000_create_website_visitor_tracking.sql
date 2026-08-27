-- Self-hosted website visitor de-anonymisation (Leadfeeder / Apollo replacement).
--
-- A tiny script on the marketing site (Framer) posts page views to the
-- track-website-visit edge function. The function resolves the visitor IP to an
-- organisation, throws away the raw IP (only a salted hash is stored) and writes
-- a row here. Companies are then aggregated by the website_visitor_companies view.

-- ── Sites ──────────────────────────────────────────────────────────────────
-- One row per tracked website. site_key is public (it ships in the page source),
-- so it only identifies where a hit came from — it grants no read access.
CREATE TABLE IF NOT EXISTS public.visitor_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  name TEXT NOT NULL,
  domain TEXT,                                  -- e.g. 'skillstudio.ai'
  site_key TEXT NOT NULL UNIQUE
    DEFAULT replace(gen_random_uuid()::text, '-', ''),

  -- Optional allow-list of hostnames that may send hits. Empty = accept any.
  allowed_origins TEXT[] NOT NULL DEFAULT '{}',

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Page views ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.website_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.visitor_sites(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Browser session (sessionStorage id from the tracker, not a durable cookie)
  session_id TEXT,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Page
  path TEXT,
  page_title TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,

  -- Visitor. The raw IP is never stored: ip_hash is sha-256(ip + secret salt),
  -- which is enough to de-duplicate and cache lookups but not to re-identify.
  ip_hash TEXT,
  user_agent TEXT,
  country TEXT,
  region TEXT,
  city TEXT,

  -- Resolved organisation
  company_name TEXT,
  company_domain TEXT,
  asn TEXT,
  asn_name TEXT,
  asn_type TEXT,

  -- 'company' = a real organisation worth showing in the CRM.
  -- 'isp' / 'hosting' / 'bot' / 'unknown' = noise, kept for the hit rate stats.
  classification TEXT NOT NULL DEFAULT 'unknown'
    CHECK (classification IN ('company', 'isp', 'hosting', 'bot', 'unknown')),

  matched_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  resolver TEXT,          -- which provider answered ('ipapi_is', 'ipinfo', 'cache', 'none')
  raw JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS website_visits_user_time_idx
  ON public.website_visits (user_id, visited_at DESC);

CREATE INDEX IF NOT EXISTS website_visits_user_domain_idx
  ON public.website_visits (user_id, company_domain)
  WHERE company_domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS website_visits_session_idx
  ON public.website_visits (session_id);

-- ── IP → organisation cache ────────────────────────────────────────────────
-- Reverse-IP providers charge (or rate limit) per lookup, and a single visitor
-- generates many page views. Resolve each ip_hash once and reuse the answer,
-- so a busy day costs a handful of lookups instead of thousands.
CREATE TABLE IF NOT EXISTS public.visitor_ip_cache (
  ip_hash TEXT PRIMARY KEY,
  company_name TEXT,
  company_domain TEXT,
  asn TEXT,
  asn_name TEXT,
  asn_type TEXT,
  classification TEXT NOT NULL DEFAULT 'unknown',
  country TEXT,
  region TEXT,
  city TEXT,
  resolver TEXT,
  raw JSONB,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS visitor_ip_cache_resolved_at_idx
  ON public.visitor_ip_cache (resolved_at);

-- ── Aggregated view: one row per company per site ──────────────────────────
-- security_invoker keeps the RLS policy on website_visits in force for readers.
CREATE OR REPLACE VIEW public.website_visitor_companies
WITH (security_invoker = ON) AS
SELECT
  v.user_id,
  v.site_id,
  v.company_domain,
  (array_agg(v.company_name ORDER BY v.visited_at DESC)
     FILTER (WHERE v.company_name IS NOT NULL))[1]        AS company_name,
  (array_agg(v.country ORDER BY v.visited_at DESC)
     FILTER (WHERE v.country IS NOT NULL))[1]             AS country,
  (array_agg(v.city ORDER BY v.visited_at DESC)
     FILTER (WHERE v.city IS NOT NULL))[1]                AS city,
  (array_agg(v.path ORDER BY v.visited_at DESC))[1]       AS last_path,
  (array_agg(v.referrer ORDER BY v.visited_at DESC)
     FILTER (WHERE v.referrer IS NOT NULL))[1]            AS last_referrer,
  (array_agg(v.matched_company_id ORDER BY v.visited_at DESC)
     FILTER (WHERE v.matched_company_id IS NOT NULL))[1]  AS matched_company_id,
  count(*)                                                AS page_views,
  count(DISTINCT v.session_id)                            AS visit_count,
  count(DISTINCT v.path)                                  AS unique_pages,
  min(v.visited_at)                                       AS first_seen,
  max(v.visited_at)                                       AS last_seen
FROM public.website_visits v
WHERE v.classification = 'company'
  AND v.company_domain IS NOT NULL
GROUP BY v.user_id, v.site_id, v.company_domain;

-- ── RLS ────────────────────────────────────────────────────────────────────
-- The edge function writes with the service role, so it bypasses these; they
-- exist to scope what the browser client can read.
ALTER TABLE public.visitor_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_ip_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own visitor sites" ON public.visitor_sites;
CREATE POLICY "Users can manage their own visitor sites"
  ON public.visitor_sites FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own website visits" ON public.website_visits;
CREATE POLICY "Users can manage their own website visits"
  ON public.website_visits FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- The cache holds no user data and is never read from the browser.
DROP POLICY IF EXISTS "No client access to the IP cache" ON public.visitor_ip_cache;
CREATE POLICY "No client access to the IP cache"
  ON public.visitor_ip_cache FOR SELECT
  USING (FALSE);

-- ── updated_at ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_visitor_sites_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visitor_sites_updated_at ON public.visitor_sites;
CREATE TRIGGER visitor_sites_updated_at
  BEFORE UPDATE ON public.visitor_sites
  FOR EACH ROW EXECUTE FUNCTION public.update_visitor_sites_updated_at();
