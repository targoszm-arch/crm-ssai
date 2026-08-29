# Skill Studio AI CRM — working notes

Vite + React + TypeScript + shadcn/ui, backed by Supabase (project `getqcxnjsohtlagscmfc`).
See `README.md` for setup and deployment. This file holds the decisions and constraints that
aren't obvious from the code.

## Critical rules

**Content Lab is a PUBLIC product.** As of Monday 31 August 2026 it has external customers.
It is no longer an internal tool. Do not wire Content Lab to this CRM — no shared tables, no
direct reads, no CRM-specific assumptions in its code. Newsletters go out from Content Lab
itself. If the two ever need to exchange data, it goes through a documented public API, the
same one any other customer would use.

**Two email machines, kept apart.** Nobody is in both at once.

| | Cold outbound | Lifecycle |
|---|---|---|
| Consent basis | permission being earned | permission already granted |
| Sender | the connected mailbox (Gmail API, `send-email`) | Resend, `skillstudio.ai`, EU region |
| Owner | this CRM's sequence engine | Resend |
| Contents | prospects who have not signed up | anyone who has signed up |

The moment someone signs up they leave cold outbound permanently. Never send cold-shaped
mail through Resend — it is a permission-based ESP and the domain is the thing at risk.

**Never enrol without checking three things:** marketing consent, the suppression list, and
whether they are a paying customer. Customer exclusion is a query
(`stripe_subscription_id is not null` in the LMS), never a hand-maintained list of names —
there were 64 live subscriptions as of 29 Aug 2026, not the two we had written down.

## Consent conventions (LMS)

`gdpr_consents` is the state table, and as of 29 Aug it is the accurate one — 228 `product`
rows and 21 granted `marketing` rows (plus 1 revoked), backfilled from `profiles`. When writing consent anywhere:

- `consent_type` is a bare noun: `'marketing'`, `'product'`. Never `'marketing_emails'`.
- Never write a `granted = false` marketing row. The absence of a row is stronger evidence
  of non-consent than a false one someone could argue was a default. Revocation is
  different — that keeps the row and stamps `revoked_at`.
- `marketing_consent_log.action` only accepts `consent_requested`, `consent_granted`,
  `consent_denied`, `consent_revoked`.
- `marketing_consent_verified_at` is null for all 228 profiles. Nobody has confirmed
  anything yet, so the real marketing list is 22 unverified addresses.

## System of record

`LMS -> CRM -> Resend`, one direction only. The LMS owns consent state
(`gdpr_consents`), the CRM owns leads and companies, Resend owns sending for lifecycle.
This CRM's `user_consent` table mirrors the LMS; it never competes with it.

## Known state (verified 29 Aug 2026)

- **Contacts 5,781 / companies 1,217**, growing ~10–17 a day, all from Meet Alfred
  (LinkedIn). 62k rows in `activities`, all `source = 'meetalfred'`.
- **`lms_leads` is empty.** `lms-webhook` would write to `contacts`, `lms_leads` and
  `activities`, but has never fired. LMS customers currently reach the UI only through
  `fetch-lms-customers`, which is a live read-through to the LMS `crm-customers` endpoint —
  displayed, never stored, so those people cannot be segmented or enrolled.
- **The sequence engine has never run for real.** One sequence, four enrolments, seven
  emails, all to `magda@skillstudio.ai`; five stalled at `delivery_status = 'pending'` with
  the fallback subject "Message from us" (the template lookup failed). Zero rows in
  `email_tracking_events`. Treat it as unbuilt.
- Sequence steps are email-only: `{ day, subject, template }`. The `tasks` table exists but
  nothing writes to it and there is no UI for it.
- Sequences currently send via Resend on a fixed from-address. Per the two-machine rule that
  is wrong for cold outbound and needs to move to `send-email`.
- Mail and calendar sync are **Google only**. Confirm before assuming Microsoft 365 works.

## Decisions

- **HubSpot: dropped.** Portal 147027183 never completed onboarding — 335 stale contacts,
  0 deals, 3 unsent draft emails. Only meeting logging was live.
- **Apollo: dropping.** Cold outbound is parked, so nothing depends on its sequencer.
  Export first with `supabase/functions/export-apollo` (sequences, copy, and all saved
  contacts). Keep buying prospect data on a pay-per-use tier; do not rebuild a B2B database.
- **Segmentation by click is the reason to own this CRM.** `track-sequence-click` already
  records `contact_id` + `link_url` + `event_type = 'click'`. Tagging the CTA links by topic
  and routing a click into a label, list and follow-on sequence is the differentiating
  feature — neither Apollo nor free HubSpot can do it.

## Handover to the LMS project

`docs/lms/` holds work that belongs to the LMS Supabase project
(`oxlujbymtjugefaqmwuy`), not this repo. Read the README there before running any of it.
