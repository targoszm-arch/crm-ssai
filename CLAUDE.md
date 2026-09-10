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
there were 67 live subscriptions on 10 Sep 2026, not the two we had once written down.

## Consent conventions (LMS)

`gdpr_consents` is the state table, and it is the accurate one — 229 `product` rows and 21
granted `marketing` rows (plus 1 revoked), backfilled from `profiles`. When writing consent
anywhere:

- `consent_type` is a bare noun: `'marketing'`, `'product'`. Never `'marketing_emails'`.
- Never write a `granted = false` marketing row. The absence of a row is stronger evidence
  of non-consent than a false one someone could argue was a default. Revocation is
  different — that keeps the row and stamps `revoked_at`.
- `marketing_consent_log.action` only accepts `consent_requested`, `consent_granted`,
  `consent_denied`, `consent_revoked`.
- `marketing_consent_verified_at` is null for all 239 profiles. Nobody has confirmed
  anything yet, so the real marketing list is 22 unverified addresses.

## System of record

`LMS -> CRM -> Resend`, one direction only. The LMS owns consent state
(`gdpr_consents`), the CRM owns leads and companies, Resend owns sending for lifecycle.
This CRM's `user_consent` table mirrors the LMS; it never competes with it.

## Known state (verified 10 September 2026)

Re-check these with a query before relying on them; they move.

- **Contacts 2,837 / companies 882.** Still overwhelmingly Meet Alfred (LinkedIn). 68,817 rows
  in `activities`, of which 67,358 are `source = 'meetalfred'`.
- **A dedupe ran on 7 Sep 2026 and the contact count roughly halved.** 1,843 losers merged into
  313 survivors, kept in `dedupe_backup_contacts_20260907` and `dedupe_map_20260907`
  (`loser_id → survivor_id`); none of the 1,843 is still in `contacts` and every survivor is.
  **The arithmetic does not close.** This file previously recorded 5,781 contacts on 29 Aug;
  5,781 − 1,843 = 3,938, not 2,837, so about 1,100 contacts left by some other route with no
  backup, and companies fell 1,217 → 882 with no backup table at all. Either the 29 Aug figure
  was wrong or something else deleted rows. Settle that before dropping the backup tables —
  they are the only copy.
- **Real (non-MeetAlfred) activity: 1,459 rows**, 1,257 of them with a `company_id`, covering
  412 people and 285 companies, earliest 2 Nov 2025. Most of that is the September backfill
  from `emails`; those rows carry `metadata.email_id`, which is what makes them openable in the
  UI. The 16 hand-written activity descriptions predating it were left alone.
- **Emails 2,963 — 1,428 linked to a contact, 1,535 not.** The unlinked remainder is
  newsletters and vendors; linking them means creating contacts, which is a decision, not a
  backfill.
- **`lms_leads` is still empty.** `lms-webhook` would write to `contacts`, `lms_leads` and
  `activities`, but has never fired. LMS customers reach the UI only through
  `fetch-lms-customers`, a live read-through to the LMS `crm-customers` endpoint — displayed,
  never stored, so those people cannot be segmented or enrolled.
- **The sequence engine has still never run for real.** 60 sequences now, but 59 are drafts
  created 30 Aug – 1 Sep; the only `active` one is the original from January. Four enrolments,
  seven emails, all to `magda@skillstudio.ai`; five stuck at `delivery_status = 'pending'` with
  the fallback subject "Message from us" (the template lookup failed). Zero rows in
  `email_tracking_events`. Treat it as unbuilt.
- **Click segmentation is half-built.** `sequence_click_routes` exists
  (`topic`, `match_pattern`, `label`, `enrol_sequence_id`, `priority`, `is_active`) and
  `useClickRoutes.ts` reads it, but of its four rows only `sop` is active — the other three are
  `RENAME-card-2/3/4` placeholders. `track-sequence-click` records the click; nothing yet
  routes it into a label, list or follow-on sequence.
- **`lists` exists and is empty**, with no membership table and no code referencing it. The
  table is not the feature.
- Sequence steps are email-only: `{ day, subject, template }`. `tasks` exists, is empty, and
  nothing writes to it.
- **Sequences still send via Resend on a fixed from-address** (`send-sequence-email` imports
  `npm:resend`). Per the two-machine rule that is wrong for cold outbound and needs to move to
  `send-email`. This is the one open item that breaks a rule above rather than merely leaving
  something unbuilt.
- 34 deals, 1 connected mailbox, `crm_files` empty (the Files tab shipped unused),
  `user_consent` empty (it mirrors the LMS; the LMS is the source of truth).
- Mail and calendar sync are **Google only**. Confirm before assuming Microsoft 365 works.

## UI conventions

Established September 2026. They exist because the app had drifted into five different page
layouts and buttons in five different places.

- **`AppShell` owns page width and padding.** Every page fills the screen with a 10px side
  margin — no max width, no centred column, no exceptions. A centred `max-w-[1200px]` column
  was tried and reverted the same day: on a wide screen it left a screen's worth of empty
  margin either side of the content, which is the opposite of filling the screen. A page
  component renders its content and no outer wrapper of its own.
- **Routes are a table**, `PROTECTED_ROUTES` in `App.tsx`, so a page cannot quietly opt out of
  the shell by being wrapped differently.
- **The height chain is real.** `SidebarInset` is `h-svh`, `main` and the container are
  `min-h-0 flex-1`, so a page that wants to fill the screen says `flex-1 min-h-0` and means it.
  Don't reach for `h-[calc(100vh-…)]`; that arithmetic was removed.
- **Page actions live in the top bar.** Wrap them in `<PageActions>` (`layout/PageActions.tsx`)
  and they portal into a slot in the header. It is a portal, not state — a page hands over a
  node on every render, and storing that in the provider would set state during render and
  loop. Filters and view toggles stay on the page; only things that *do* something move.
- **Never render a `mailto:` link as a Send email action.** The OS takes the click, the CRM
  logs nothing. Open `ComposeEmail` with `defaultTo` and `defaultContactId`. (Three plain
  address links remain in `CustomersTab`, `ContactDetailContent` and `OrganisationDetailContent`
  — those render an address, not an action.)
- **History opens beside the record, not instead of it.** `HistoryPanel` is a fixed `aside`
  under the header, scoped to a contact *or* a company, with `name › History › subject`
  breadcrumbs. Deliberately not a `Sheet`: that ships a `bg-black/80` overlay that would dim
  the record the panel exists to keep visible.
- **Linking a deal updates the deal.** `LinkedDealsCard` sets `contact_id`/`company_id` on an
  existing row rather than creating a second one — creating one is how a pipeline counts the
  same money twice.
- Dialogs taller than the viewport need `max-h-[90vh]` and a scrolling body. `AddDealModal`
  lost its Create button off-screen for a release because it had `overflow-hidden` and no cap.

## Decisions

- **HubSpot: dropped.** Portal 147027183 never completed onboarding — 335 stale contacts,
  0 deals, 3 unsent draft emails. Only meeting logging was live.
- **Apollo: dropping.** Cold outbound is parked, so nothing depends on its sequencer.
  Export first with `supabase/functions/export-apollo` (sequences, copy, and all saved
  contacts). Keep buying prospect data on a pay-per-use tier; do not rebuild a B2B database.
- **Segmentation by click is the reason to own this CRM.** `track-sequence-click` already
  records `contact_id` + `link_url` + `event_type = 'click'`, and `sequence_click_routes` now
  holds the topic → label → follow-on-sequence mapping. What is missing is the step that acts
  on a click. That step is the differentiating feature — neither Apollo nor free HubSpot can
  do it.

## Handover to the LMS project

`docs/lms/` holds work that belongs to the LMS Supabase project
(`oxlujbymtjugefaqmwuy`), not this repo. Read the README there before running any of it.
