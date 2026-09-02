# Signup lifecycle webhooks

Belongs to the **LMS** Supabase project (`oxlujbymtjugefaqmwuy`), not to this repo — same
arrangement as `01`–`03` next door. Nothing here is deployed.

Built to the 1 Sep spec. Three of its strings are wrong against the live schema and are
corrected here; see **Spec corrections** below, because the corrections change what you
type but not what the machine does.

| | What it does | Blast radius |
|---|---|---|
| `00-consent-log-consent-type.sql` | Adds `marketing_consent_log.consent_type` | One nullable column, one backfill of existing rows to `'marketing'` |
| `signup-lifecycle/` | `track-user-signup` + consent + Resend + CRM | **No email.** Creates Resend contacts and CRM leads |
| `course-built-lifecycle/` | Flips a signup to `lifecycle = builder` | **No email.** Updates Resend contact properties |
| `01-course-built-triggers.sql` | Fires the above from `courses` / `course_generation_jobs` | Two triggers, both fire-and-forget |

Neither webhook sends anything. They populate the segments and properties that the
re-engagement sequence later reads. Sending stays a separate, deliberate act.

## The open question, answered

> **What does `check-abandoned-signups` actually say?** If the existing reminder already
> reads as a welcome, the two need merging rather than both sending.

**It is not a welcome, and they do not need merging.** It selects
`completed_at IS NULL AND reminder_sent_at IS NULL` and older than an hour, and sends
*"You were so close!"* — subject line included — with a body that says *"you started
signing up but didn't finish"*, naming the step they stopped at, over a **Continue Signup**
button pointing at `?resume=<session id>`.

It is an abandonment recovery nudge addressed to someone who is **not** a user. Indoctrination
email 1 fires on `auth.users` insert, which is the moment they become one. The two
populations are disjoint at send time by construction.

The one overlap is benign and correct: someone abandons, gets the nudge, comes back, and
finishes. They receive a nudge and then a welcome, in that order, which is the right
sequence of two different messages — not a welcome twice.

So email 1 is new work, not a merge. Worth knowing separately: `check-abandoned-signups`
has `verify_jwt = true` and nothing calls it, so **it has never sent a single email** —
that is what `03-schedule-abandoned-signups.sql` next door is still holding.

## Spec corrections

These are not preferences. Each one throws on insert against the live database.

| Spec said | Live schema | Used here |
|---|---|---|
| `marketing_consent_log.entity_type = 'user'` | `CHECK (entity_type IN ('profile','contact'))` | `'profile'` |
| `action = 'product_emails_granted_at_signup'` | `CHECK (action IN ('consent_requested','consent_granted','consent_denied','consent_revoked'))` | `'consent_granted'` |
| `gdpr_consents.consent_type = 'product_emails'` | Bare nouns, `UNIQUE (user_id, consent_type)`, 228 rows already `'product'` | `'product'` |

The first two would raise `23514` and the consent evidence would silently never be written
— the exact failure an audit log exists to prevent. The third is worse than an error: it
succeeds. `product_emails` and `product` are different values in a unique pair, so it would
open a second, parallel consent record for the same person and quietly split the state
table in two.

Collapsing `action` to `consent_granted` loses the distinction the spec wanted, because
nothing in the log said *which* consent a row was about. That is what `00` adds: a nullable
`consent_type` column, matching `gdpr_consents`'s vocabulary. `action` says what happened,
`entity_type` says to whom, `consent_type` says about what. Existing rows backfill to
`'marketing'` — the table was built for the marketing opt-in flow and product consent was
never logged in it.

**The two rules that matter more than the strings are both kept exactly.** No
`marketing` row is written at signup, of either polarity. And `Compliance Training Note`
is never touched — not even as an explicit `opt_out`, because writing it would mean the
signup function has an opinion about a consent nobody has given.

## Two smaller corrections, same kind

**`module_count` cannot come from `courses.modules`.** That jsonb column is `[]` on all 726
rows. The real data is `course_modules` (5,785 rows) and `course_videos` (354), both keyed
on `course_id`. Reading `modules` would report every builder as having built nothing, which
is exactly the signal this webhook exists to carry.

**The consent IP is not the request IP.** `track-user-signup` is called by pg_net from a
database trigger, so the connecting address is Supabase's own infrastructure and the user
agent is pg_net's. Writing those into a consent record would be recording the database as
the consenting party. This reads `raw_user_meta_data.signup_ip` / `signup_user_agent` and
writes null when the browser's values were never captured. **They currently are not** —
if the IP matters for the DPA review, the signup form has to start sending it; a consent
row with a null IP is still valid evidence, one with a confidently wrong IP is not.

## What each function does

### `signup-lifecycle/` — replaces `track-user-signup`

The deployed function (version 30) unchanged, plus one `runLifecycle()` call at the end.
Everything above that function is byte-identical to what is live, so the diff is only what
is new. Trigger, secret gate and single-fire guarantee are untouched.

1. **Consent.** Upserts `gdpr_consents` (`product`, granted) on the `(user_id,
   consent_type)` pair, and appends the evidence row. Runs for everyone, including excluded
   addresses — exclusion is about not mailing someone, not a reason to lose what they agreed to.
2. **Resend.** One `POST /contacts` carrying `segmentIds` and `topics` inline, so the
   contact, its segment and its topic cannot half-apply. A duplicate returns 409, which is
   treated as success and logged as `deduped` — the contact exists, which is all that was
   wanted.
3. **CRM.** POSTs the existing `lms-webhook` in the CRM project, which already knows how to
   write `contacts`, `lms_leads` and `activities`. That endpoint has existed and never
   fired; this is what fires it.

Needs three new env vars for step 3: `CRM_LMS_WEBHOOK_URL`, `CRM_WEBHOOK_API_KEY`,
`CRM_OWNER_USER_ID`. Without them step 3 logs a warning and skips; 1 and 2 still run.
`RESEND_API_KEY` is the existing one.

### `course-built-lifecycle/` — new function

Reads the course, resolves the owner's email through `profiles`, counts modules and videos,
classifies the topic cluster from title and description, and PATCHes the Resend contact to
`lifecycle = builder`.

Idempotent by construction: it reads current counts and writes them, so both triggers
landing on the same course is a no-op rather than a conflict. A 404 from Resend is the
ordinary case for a signup that predates webhook 1 — logged, not failed.

`classifyTopicCluster` is ordered, not scored, and the order is the point: a course about
securing clinical records is a cybersecurity course before it is a clinical one, because
the proof link that lands should be about what the course teaches. `other` is a real
answer, not a fallback.

## Deploy order

1. **`00-consent-log-consent-type.sql`.** Must be first — `signup-lifecycle` writes the
   column it adds. Safe on its own: additive, nullable, no behaviour change.
2. **`signup-lifecycle/`** over `track-user-signup`, keeping `verify_jwt = false`. Set the
   three CRM env vars first, or accept that leads land in Resend but not the CRM until you do.
3. **`course-built-lifecycle/`**, also `verify_jwt = false` — it is gated by
   `x-webhook-secret` like its sibling, reusing `app.webhook_signup_secret`.
4. **`01-course-built-triggers.sql`** last, once the function it calls is deployed.

### Before step 2, decide about the backlog

There are 228 profiles and **zero** of them have a Resend contact from this path. Webhook 1
only fires on new signups; it will not go back. Whether the existing 228 get backfilled is a
separate decision with a real consequence — they signed up before this consent record
existed, so a backfill writes 228 `consent_granted` rows stamped today for consent given
months ago. Backdating them to `profiles.created_at` is the honest version if you do it.

`lms_leads` is still empty, so the CRM has genuinely never received a signup. Step 2 fixes
that going forward; `backfill-lms-leads` in the CRM is the separate tool for the history.

## Verifying without sending

```sql
-- Consent written correctly, one row per person per type.
select consent_type, granted, count(*) from public.gdpr_consents group by 1,2 order by 1;

-- The evidence trail for one person.
select action, consent_type, created_at, ip_address
from public.marketing_consent_log where entity_id = '<user id>' order by created_at;

-- What the course webhook would report for a given course.
select c.title,
       (select count(*) from public.course_modules m where m.course_id = c.id) as modules,
       (select count(*) from public.course_videos v where v.course_id = c.id)  as videos
from public.courses c where c.id = '<course id>';
```

On the Resend side, the segment `LMS · New Signups` growing while
`Compliance Training Note` stays at zero subscribers is the shape you want. If that topic
ever has members before email 4 ships, something wrote a consent nobody gave.
