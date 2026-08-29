# LMS handover

These three items belong to the **LMS** Supabase project (`oxlujbymtjugefaqmwuy`), not to
this repo. They live here because that is where the work was specified; move them into the
LMS repo when convenient.

`01` was applied on 2026-08-29. `02` and `03` are written but not deployed — `03` in
particular sends email to real people, so read its header before running it.

| | What it does | Blast radius |
|---|---|---|
| `01-consent-state-backfill.sql` | **Applied 29 Aug.** Made `gdpr_consents` the real state table: 228 `product` rows + 2 missing `marketing` rows | Consent records only, no email |
| `02-confirm-marketing-consent/` | Not deployed. The opt-in / unsubscribe endpoint behind Email 4, the CRM unsubscribe, and the abandoned-signup footer | New public endpoint. Deploy with `verify_jwt = false` |
| `03-schedule-abandoned-signups.sql` | Not run, deliberately held. Puts `check-abandoned-signups` on an hourly cron | **Emails up to 50 real people on first run.** Check the backlog query first |

## Why each exists

**Consent state is split in two.** `gdpr_consents` is the state table by design but held 20
rows against 228 profiles; the column the signup flow actually writes is
`profiles.marketing_emails_consent` (21 true / 207 false). The backfill makes the designed
answer the true one. It deliberately writes no `granted = false` marketing rows — the
absence of a row is stronger evidence of non-consent than a false row someone could later
argue was a default.

**Nobody has ever confirmed marketing consent.** `marketing_consent_verified_at` is null for
all 228 profiles. The token columns to fix that already exist on both `profiles` and
`contacts`; there was simply no endpoint writing to them. That is `02`. The same endpoint
replaces the static `skillstudio.ai/unsubscribe` link in the abandoned-signup email footer,
which currently records nothing at all.

**74 people are waiting on a cron job.** `check-abandoned-signups` is deployed at version 64,
has `verify_jwt = true`, and nothing calls it — so it has never sent a single email. `03`
schedules it from pg_cron with the service role key, without opening the endpoint up.

## Schema conventions

Taken from the live database, not from the original spec, which got two of them wrong:

- `gdpr_consents.consent_type` is a bare noun — `'marketing'`, not `'marketing_emails'` —
  with `UNIQUE (user_id, consent_type)`. Product consent follows suit as `'product'`.
- `marketing_consent_log.action` is CHECK-constrained to `consent_requested`,
  `consent_granted`, `consent_denied`, `consent_revoked`. Anything else fails the insert.
- `marketing_consent_log.entity_type` is CHECK-constrained to `profile` or `contact`.

## Conflict resolved

One person disagreed across the two sources: `gdpr_consents` recorded marketing consent
granted on their signup date, while `profiles.marketing_emails_consent` was false. Decided
29 Aug — **treat as non-consenting**. The row was revoked rather than deleted, because a
revocation you cannot evidence is as bad as no consent record, and logged as
`consent_revoked`. `marketing` granted is now 21, exactly matching the profile flags.

## Remaining order

1. Deploy `02` (`verify_jwt = false`), then point Email 4, the CRM unsubscribe, and the
   abandoned-signup footer at it. Test with a real token end to end before it goes in an email.
2. Look at the backlog query in `03` and decide how far back you are willing to contact
   someone. Mark the rest as already reminded, then schedule.
