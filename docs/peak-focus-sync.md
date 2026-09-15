# CRM → Peak Focus: staged, not switched on

**Status: staged. Nothing has been written to Peak Focus.** The schema on both sides is
live, the identity links are seeded, and the push runs as a dry run that reports what it
would change. Turning it on is one call with `{"dry_run": false}`.

## What was actually wrong

Peak Focus grew a second CRM. Its `clients` table carries `stage`, `health`, `arr`,
`renewal`, `contact_name` and `email`, and its Clients screen renders **Total ARR**,
**At risk** and **Renewals in 90 days** stat cards off those numbers. So there were two
commercial readouts, maintained by hand, with no rule for which one wins:

| | CRM | Peak Focus |
|---|---|---|
| Altuent | Sales Qualified | Pipeline |
| Eni Plenitude | Demo Done | Pipeline |
| Enterprise Ireland | Discovery | Active |
| Laurel Ridge Ventures | Discovery | Prospect |
| My FRKL | Sales Qualified, EUR 2,400 won | Pipeline, EUR 8,000 ARR |

`companies.estimated_arr` is null for all eleven linked companies, so **no CRM readout can
see any of the EUR 138,000 of ARR recorded in Peak Focus.** That is the pollution: the CRM
is not wrong so much as blind, and Peak Focus is authoritative about money nobody asked it
to be authoritative about.

Two half-built integrations were already in the way, both pointing the other direction and
neither ever run:

* `20260901050000` — a `postgres_fdw` read-across so the CRM could read Peak Focus tasks.
  The server exists; **the user mapping was never created and no foreign table was ever
  imported.**
* `20260904000652` — made Peak Focus the *author* of clients and projects with the CRM
  mirroring them inbound. **`peak_focus_sync_runs` is empty.** It also never landed in this
  repo, so the repo and the database disagreed for eleven days. Both it and
  `20260904084311` are now recovered verbatim as migrations.

## The rule now

`LMS → CRM → Resend` gains a third leg on the same one-direction principle:

```
CRM  ──(stage, ARR)──▶  Peak Focus
```

**The CRM owns commerce. Peak Focus owns the work.** Nothing flows back.

| | Fields |
|---|---|
| CRM authors | `stage`, `arr` |
| Fill-if-blank only | `website`, `email`, `contact_name` |
| Peak Focus keeps | `name`, `color`, `health`, `renewal`, `location`, `contact_role`, and every project, task, wiki page, tag and meeting |

`name` is deliberately **not** pushed. The CRM's names are bulk-import artefacts and are
worse: `Pbbtinstitute`, `MyFRKL`, `SkillStudio`, `Brilliancy Deep Tech`. Pushing them would
degrade Peak Focus on the first run. Same for `contact_role` — the CRM's matching title for
Brilliancy is a 200-character LinkedIn headline.

## Scope: the part that matters

The CRM holds **882 companies and 3,864 contacts**, overwhelmingly Meet Alfred LinkedIn
prospects. Pushing all of them would make Peak Focus's Clients screen useless — the same
complaint, pointed the other way.

The first rule tried was *linked, or holding a deal that is not Closed Lost*. Dry-run
against live Peak Focus it scoped 28 companies and wanted to **create 17 clients**:
American Express, Bank of America, Deloitte, Deutsche Bank, EY, KPMG US, Kroll, LSEG,
Mercor, New York Life, PENNYMAC, Squarespace, Vanguard, Concentrix, Handshake AI, Grocerix,
InterTradeIreland. Every one is a cold prospect whose only deal sits at *Contact Made* or
*Marketing Qualified*.

So the funnel has a floor. A company reaches Peak Focus when it is **already linked**, or
when a deal reaches **1st Follow Up, Demo Done, Sales Qualified, Intention to Buy or Closed
Won**. Top of funnel stays in the CRM, which is what a CRM is for. That scopes **14**.

## Dry run, 15 September 2026

Real, against live Peak Focus. Nothing written.

```
scoped 14   insert 3   update 8   unchanged 2   excluded 1
```

| Client | Action | Change |
|---|---|---|
| Altuent | unchanged | — |
| Eni Plenitude | unchanged | — |
| AWE XR | update | fills blank website, email, contact |
| Brilliancy Health | update | fills blank website |
| Mastercard | update | fills blank email |
| PBBT Institute | update | fills blank email |
| Enterprise Ireland | update | **stage Active → Pipeline**, fills email + contact |
| Laurel Ridge Ventures | update | **stage Prospect → Pipeline** |
| NKD | update | **stage Prospect → Pipeline**, fills website |
| My FRKL | update | **stage Pipeline → Active, ARR 8,000 → 2,400** |
| Grocerix | insert | new client |
| InterTradeIreland | insert | new client |
| Vanguard | insert | new client |
| Skill Studio AI | **excluded** | internal workspace, never authored by the CRM |

### Two things to decide before the real push

1. **My FRKL ARR drops 8,000 → 2,400.** Peak Focus says 8,000; the CRM's only Closed Won
   deal is 2,400. One of them is wrong and the sync cannot know which. Fix the CRM deal
   first if 8,000 is right — after the push the CRM's number wins by definition.
2. **EUR 85,600 of Peak Focus ARR belongs to clients the CRM has never heard of:**
   Proximo Ventires (50,000), Finance in Motion (15,000), Medivra (15,000). None has a CRM
   company. They are not touched by the push and will keep drifting until they exist in the
   CRM as companies with deals. That is data entry, not a sync problem.

Also worth knowing: **Medivra and Brilliancy Health are the same account** (both
`chris@medivrasolutions.com`), and **Laurel Ridge Ventures and My FRKL are both Dan
Kaminski**. Peak Focus carries them as four clients.

## How it works

* `public.peak_focus_client_scope` (CRM) — the view that decides who is in scope and what
  values the CRM authors. Not readable by the browser.
* `public.crm_upsert_clients(p_rows jsonb, p_dry_run boolean)` (Peak Focus) — the only
  write surface. Service-role only. Upserts on `clients.crm_company_id`. **Never deletes**,
  never touches a `crm_sync_excluded` row, and writes only fields it was handed.
* `supabase/functions/push-peak-focus` (CRM) — reads the scope, calls the function, writes
  a `peak_focus_push_runs` row with the full per-client diff. **Dry run unless you pass
  `{"dry_run": false}`.**

Idempotent: the link is a unique index, so a second run changes nothing.

### Turning it on

```bash
supabase secrets set PEAK_FOCUS_SERVICE_ROLE_KEY=<peak focus service role key> \
  --project-ref getqcxnjsohtlagscmfc
supabase functions deploy push-peak-focus --project-ref getqcxnjsohtlagscmfc

# read it first
curl -s -X POST .../push-peak-focus -H "Authorization: Bearer $JWT" -d '{}'
# then, only if the diff is right
curl -s -X POST .../push-peak-focus -H "Authorization: Bearer $JWT" -d '{"dry_run":false}'
```

### Still to do

* Peak Focus's Clients screen still lets you edit `stage` and `arr` by hand. Once the push
  is on, those two fields should render read-only with a deep link back to the CRM when
  `crm_managed` is true — an editable field the next sync overwrites is worse than no field.
* `renewal` has no CRM column. It stays hand-kept in Peak Focus; if renewals start
  mattering commercially it needs a home in the CRM first.
* The inbound FDW (`20260901050000`) is still unconnected. It is not needed for this and
  can stay that way.
