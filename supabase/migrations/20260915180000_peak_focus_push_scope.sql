-- The CRM becomes the system of record for a client's commercial facts, and pushes them
-- to Peak Focus. This reverses the direction of 20260904000652.
--
-- WHY REVERSE IT. That migration made Peak Focus the author of clients and projects and
-- had the CRM mirror them inbound. The sync never ran: peak_focus_sync_runs is still
-- empty, and so is the FDW link from 20260901050000 (the server exists, the user mapping
-- was never created, no foreign table was ever imported). What actually happened is that
-- both sides were kept by hand and drifted:
--
--   * Peak Focus holds EUR 138,000 of ARR across five clients. companies.estimated_arr is
--     null for all eleven linked companies, so no CRM readout can see any of it.
--   * The stage fields contradict each other on every linked client. Eni Plenitude is
--     "Demo Done" here and "Pipeline" there; Enterprise Ireland is "Discovery" here and
--     "Active" there; Altuent is "Sales Qualified" here and "Pipeline" there.
--   * Peak Focus's Clients screen renders Total ARR, At-risk and Renewals-in-90-days stat
--     cards off its own numbers — a full commercial readout maintained independently of
--     this CRM.
--
-- Two answers to "how is this account doing" and no rule for which wins. The rule is now:
-- the CRM wins on commerce, Peak Focus wins on work.
--
-- WHAT THIS EXTENDS. CLAUDE.md records `LMS -> CRM -> Resend`, one direction only. This
-- adds a third leg on the same principle: `CRM -> Peak Focus`, commercial fields only.
-- Nothing flows back. The CRM's own projects and tasks tables hold zero rows and stay that
-- way — Peak Focus authors those and the CRM reads them through the functions in
-- 20260901050100 if the FDW is ever finished.
--
-- SCOPE IS THE WHOLE DESIGN, AND THE FIRST RULE WAS WRONG. The CRM holds 882 companies and
-- 3,864 contacts, overwhelmingly Meet Alfred LinkedIn prospects. Pushing all of them would
-- turn a 21-row client roster into an 882-row one and make Peak Focus's ARR and at-risk
-- counts meaningless -- the same pollution complaint, pointed the other way.
--
-- The obvious narrow rule -- linked, or holding a deal that is not Closed Lost -- still
-- was not narrow enough. Dry-run against the live Peak Focus on 15 September 2026 it
-- scoped 28 companies and wanted to CREATE 17 clients: American Express, Bank of America,
-- Deloitte, Deutsche Bank, EY, KPMG US, Kroll, LSEG, Mercor, New York Life, PENNYMAC,
-- Squarespace, Vanguard, Concentrix, Handshake AI, Grocerix, InterTradeIreland. Every one
-- is a cold prospect whose only deal sits at "Contact Made" or "Marketing Qualified" --
-- outreach, not an account anybody is delivering work for. Seventeen empty client rows is
-- a worse Clients screen than the one being fixed.
--
-- So the funnel has a floor. A company enters Peak Focus when it is already linked, or
-- when a deal reaches a stage that implies real engagement -- 1st Follow Up, Demo Done,
-- Sales Qualified, Intention to Buy, Closed Won. Top-of-funnel stays in the CRM, which is
-- what a CRM is for. Re-running the dry run with the floor in place scopes 14 and creates
-- 3, which is the shape of the actual client list.
--
-- The floor is a list, not a position, because pipeline_stages carries no rank the view
-- could read: stages are ordered by `position` per pipeline and the CRM's deals.stage is a
-- free text label, not a foreign key. Naming the stages is honest about that; ordering by
-- a number that does not exist would not be.

create or replace view public.peak_focus_client_scope as
with won as (
  select company_id, sum(coalesce(deal_value,0)) as won_value
  from public.deals where stage = 'Closed Won' group by company_id
),
engaged as (
  select company_id,
         bool_or(stage in ('1st Follow Up','Demo Done','Sales Qualified','Intention to Buy')) as has_open,
         bool_or(stage = 'Closed Won') as has_won,
         count(*) filter (where stage <> 'Closed Lost') as live_deals
  from public.deals group by company_id
)
select
  c.id            as crm_company_id,
  c.user_id,
  c.company_name  as name,
  c.peak_focus_client_id,
  -- Stage vocabularies differ on purpose. The CRM's is a sales funnel (Contact Made ->
  -- Marketing Qualified -> ... -> Closed Won); Peak Focus's is a delivery lifecycle
  -- (Pipeline / Onboarding / Active / Expansion / Paused). Mapping to the three states
  -- Peak Focus can act on beats inventing a shared vocabulary neither screen wants.
  case
    when od.has_won  then 'Active'
    when od.has_open then 'Pipeline'
    when coalesce(od.live_deals,0) = 0 and od.company_id is not null then 'Paused'  -- every deal Closed Lost
    else 'Pipeline'                        -- linked, no deals yet
  end             as stage,
  coalesce(w.won_value, 0)::numeric as arr,
  nullif(btrim(coalesce(c.website,'')),'') as website,
  ct.email        as email,
  ct.name         as contact_name
from public.companies c
left join won       w  on w.company_id  = c.id
left join engaged    od on od.company_id = c.id
-- The contact we have spoken to most recently stands in for "who we deal with here".
-- Only ever used to fill a blank on the Peak Focus side, never to overwrite.
left join lateral (
  select ct.name, ct.email from public.contacts ct
  where ct.company_id = c.id and coalesce(btrim(ct.email),'') <> ''
  order by ct.last_contacted desc nulls last, ct.updated_at desc nulls last
  limit 1
) ct on true
-- Parenthesised deliberately: "already linked, OR engaged past the floor". Without the
-- brackets `and` binds tighter and the rule still reads correctly, but the next person to
-- add a clause here would not get that for free.
where c.peak_focus_client_id is not null
   or (od.company_id is not null and (od.has_open or od.has_won));

comment on view public.peak_focus_client_scope is
  'The companies that belong in Peak Focus, and the values the CRM authors for them. Already linked, or carrying a deal at 1st Follow Up or beyond. Read by the push-peak-focus edge function; deliberately not readable by the browser.';

revoke all on public.peak_focus_client_scope from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What the last push did.
--
-- peak_focus_sync_runs (20260904000652) described the abandoned inbound sync and counted
-- companies and projects received. This counts what was sent, and records the full diff,
-- because a push that quietly starts writing nothing is otherwise indistinguishable from
-- one with nothing to do. The old table is left in place rather than dropped: it is
-- empty, and dropping it would lose the record that that direction was tried.
-- ---------------------------------------------------------------------------
create table if not exists public.peak_focus_push_runs (
  id          uuid primary key default gen_random_uuid(),
  ran_at      timestamptz not null default now(),
  dry_run     boolean not null default true,
  ok          boolean not null,
  scoped      integer not null default 0,
  inserted    integer not null default 0,
  updated     integer not null default 0,
  unchanged   integer not null default 0,
  excluded    integer not null default 0,
  report      jsonb,
  detail      text
);
alter table public.peak_focus_push_runs enable row level security;
revoke all on table public.peak_focus_push_runs from public, anon, authenticated;

comment on table public.peak_focus_push_runs is
  'One row per push-peak-focus run. report holds the per-client diff Peak Focus returned. dry_run true means nothing was written there.';
