# LMS handover

These three items belong to the **LMS** Supabase project (`oxlujbymtjugefaqmwuy`), not to
this repo. They live here because that is where the work was specified; move them into the
LMS repo when convenient.

Nothing here has been applied. Each one touches production, and two of them send email to
real people, so read the header comment in each file before running it.

| | What it does | Blast radius |
|---|---|---|
| `01-consent-state-backfill.sql` | Makes `gdpr_consents` the real state table by backfilling 228 rows from `profiles` | Writes consent records. Idempotent, no email |
| `02-confirm-marketing-consent/` | The opt-in / unsubscribe endpoint behind Email 4, the CRM unsubscribe, and the abandoned-signup footer | New public endpoint. Deploy with `verify_jwt = false` |
| `03-schedule-abandoned-signups.sql` | Puts `check-abandoned-signups` on an hourly cron | **Emails up to 50 real people on first run.** Check the backlog query first |

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

## Suggested order

1. Run `01`. Check the verification queries at the bottom — the second should return zero rows.
2. Deploy `02` (`verify_jwt = false`), then point Email 4, the CRM unsubscribe, and the
   abandoned-signup footer at it. Test with a real token end to end before it goes in an email.
3. Look at the backlog query in `03` and decide how far back you are willing to contact
   someone. Mark the rest as already reminded, then schedule.
