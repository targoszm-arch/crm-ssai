# Website visitor tracking (Leadfeeder / Apollo replacement)

Identifies which **companies** visit the marketing site, using the same
technique Leadfeeder and Apollo use — reverse-IP lookup — but running on our own
Supabase project, with no per-lead billing and no third-party script on the site.

## How it works

```
Framer page  ──▶  public/visitor-tracking.js  ──▶  track-website-visit (edge fn)
                                                          │
                                       reverse-IP provider ─┤
                                                          ▼
                                                   website_visits
                                                          │
                                       website_visitor_companies (view)
                                                          ▼
                                                  CRM → Visitors
```

1. A ~2 KB script on the Framer site posts each page view (path, title,
   referrer, UTM parameters, a sessionStorage id).
2. The edge function reads the visitor's IP from the request headers and asks a
   reverse-IP provider which organisation owns it.
3. The IP is hashed and discarded. Only the hash, the resolved organisation and
   the page details are stored.
4. ISPs, hosting providers, VPNs and bots are classified as noise. What is left
   — corporate, education and government networks — appears under **Visitors**.

## Setup

### 1. Apply the migration and deploy the function

```sh
supabase db push
supabase functions deploy track-website-visit
```

### 2. Configure the reverse-IP provider

The function tries providers in order and falls through on failure.

| Secret | Provider | Notes |
| --- | --- | --- |
| *(none)* | ipapi.is | Works with no key at a low daily allowance. Returns the organisation **type**, which is what separates a real company from home broadband. |
| `IPAPI_IS_KEY` | ipapi.is | Raises the allowance. |
| `IPINFO_TOKEN` | IPinfo Lite | Free tier, used as a fallback. No organisation type, so ISPs are filtered by name. |
| `VISITOR_IP_SALT` | — | Salt for the IP hash. Falls back to the service role key if unset; set an independent value in production. |

```sh
supabase secrets set VISITOR_IP_SALT="$(openssl rand -hex 32)"
supabase secrets set IPAPI_IS_KEY=...      # optional
supabase secrets set IPINFO_TOKEN=...      # optional
```

Lookups are cached per hashed IP for 30 days in `visitor_ip_cache`, so a
visitor reading ten pages costs one lookup, not ten. This is what keeps a free
tier viable at normal marketing-site volume.

### 3. Add the snippet to Framer

In the CRM, open **Visitors → Setup** and copy the snippet. In Framer:
**Site Settings → General → Custom Code → End of `<body>` tag**, paste, publish.

```html
<script async
  src="https://your-crm-domain/visitor-tracking.js"
  data-site-key="YOUR_SITE_KEY"></script>
```

Optional attributes:

- `data-endpoint` — override the edge function URL.
- `data-respect-dnt="true"` — skip visitors sending Do Not Track.

### 4. Remove the old trackers

Delete anything loading `assets.apollo.io`, `trackers.apollo.io`,
`sc.lfeeder.com` or `lftracker` from Framer's custom code. Those scripts keep
running — and erroring in the browser console — once their quota is spent.

## Why the console stayed red before

Apollo's and Leadfeeder's scripts report quota and auth failures straight to the
browser. This tracker cannot:

- Every response from the edge function is `204 No Content`, including on error.
  Failures are logged server-side, never returned to the page.
- The script wraps everything in `try/catch`, sends with `sendBeacon`, and falls
  back to `fetch(..., { mode: "no-cors" })`, so a blocked or failed request
  cannot produce a CORS or network error in the console.
- It writes nothing to the console itself.

## What to expect

Reverse-IP identifies roughly **5–20%** of traffic — Leadfeeder and Apollo are
no different, they just don't show you the denominator. Most visitors are on
consumer broadband or mobile, which resolves to their ISP and no further. The
**Identification rate** metric on the Visitors page shows the real figure.

Employees working from home are invisible to every product in this category.
Anyone claiming otherwise is guessing from a cookie pool.

## Privacy

- **No raw IP is stored.** It is hashed with a server-side salt as soon as the
  lookup returns; the database only ever holds `ip_hash`.
- **No cookies.** The session id lives in `sessionStorage` and is gone when the
  tab closes.
- The lookup itself processes an IP address, which is personal data under GDPR.
  Cover company-level visitor identification in the privacy policy under
  legitimate interest, as Leadfeeder and Apollo also require.
- Setting `data-respect-dnt="true"` skips visitors who send Do Not Track.

## Schema

| Object | Purpose |
| --- | --- |
| `visitor_sites` | One row per tracked site. `site_key` is public and grants no read access. |
| `website_visits` | One row per page view, with the resolved organisation. |
| `visitor_ip_cache` | 30-day IP → organisation cache. Not readable from the browser. |
| `website_visitor_companies` | View: one row per company, aggregated. |

Row-level security scopes every table to its owner. The edge function writes
with the service role.

## Importing existing Leadfeeder data

**Visitors → Import Leadfeeder CSV** accepts both the official export and a
browser-scraped copy of the feed table, and adds the companies to
**Customers → Organisations** labelled `Website visitor (imported)`. Existing
companies are matched by name and skipped, so re-importing is safe.
