// Push the CRM's commercial truth into Peak Focus.
//
// Direction: CRM -> Peak Focus, one way. The CRM owns stage and ARR; Peak Focus owns the
// work (projects, tasks, wikis, tags) and keeps its own name, colour, health and renewal.
// Nothing comes back. See supabase/migrations/20260915180000_peak_focus_push_scope.sql for
// why this reverses the inbound mirror that 20260904000652 described and never ran.
//
// DRY RUN BY DEFAULT. POST {} and nothing is written anywhere: Peak Focus runs the same
// matching and diffing and returns what it *would* change. You have to ask for a real push
// with {"dry_run": false}. The first push is the dangerous one -- it is the only run where
// a mismatched link silently rewrites the wrong client -- so it should always be read as a
// dry run first.
//
// Every run, dry or not, writes a peak_focus_push_runs row holding the full per-client
// diff. A push that quietly starts writing nothing is otherwise indistinguishable from one
// with nothing to do.
//
// DEPLOYING THIS. It needs a [functions.push-peak-focus] block in supabase/config.toml
// with verify_jwt = true. The deploy workflow refuses to ship a function that has no
// block, because the CLI defaults verify_jwt to true and a public function that inherited
// that default would silently stop working. This function was merged without one and the
// deploy failed on exactly that gate, so it sat in main undeployed -- which is the drift
// the workflow exists to prevent.
//
// The workflow also picks what to deploy by diffing supabase/functions/**, so a commit
// that only edits config.toml triggers it and deploys nothing. Changing the block for an
// existing function means touching the function too, or running the workflow by hand with
// its name.
//
// SECRET. PEAK_FOCUS_SERVICE_ROLE_KEY is the Peak Focus project's service-role key, set as
// a Function secret on the CRM project:
//   supabase secrets set PEAK_FOCUS_SERVICE_ROLE_KEY=... --project-ref getqcxnjsohtlagscmfc
// It is a service-role key for a different project, so it is never sent to the browser and
// this function is never called with the anon key: callers must be signed in, and the
// function re-checks that before doing anything.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PEAK_FOCUS_URL = 'https://filtmcykamccfikuxehy.supabase.co';

type ScopeRow = {
  crm_company_id: string;
  name: string | null;
  stage: string;
  arr: number | string | null;
  website: string | null;
  email: string | null;
  contact_name: string | null;
};

type PushReport = {
  dry_run: boolean;
  counts: Record<string, number>;
  rows: Array<{ action: string; name?: string; changes?: unknown }>;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // Service-role client for this project: the scope view is deliberately not readable by
  // anon or authenticated, so the anon-key client below cannot select from it.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  let dryRun = true;

  try {
    // Who is asking. A push rewrites another system's client roster, so it is never
    // anonymous even though the work below runs as service role.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Not authenticated' }, 401);

    const asUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await asUser.auth.getUser();
    if (authError || !user) return json({ error: 'Not authenticated' }, 401);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    dryRun = body?.dry_run !== false;

    const pfKey = Deno.env.get('PEAK_FOCUS_SERVICE_ROLE_KEY');
    if (!pfKey) {
      return json({ error: 'PEAK_FOCUS_SERVICE_ROLE_KEY is not set on this project' }, 500);
    }

    const { data: scope, error: scopeError } = await admin
      .from('peak_focus_client_scope')
      .select('*')
      .eq('user_id', user.id);

    if (scopeError) throw new Error(`scope read failed: ${scopeError.message}`);

    const rows = (scope ?? []) as ScopeRow[];
    if (rows.length === 0) {
      return json({ dry_run: dryRun, scoped: 0, detail: 'Nothing in scope' });
    }

    // Send only the fields the CRM is allowed to author. Peak Focus enforces this too --
    // crm_upsert_clients writes nothing it was not handed -- but not sending a field at
    // all is the stronger guarantee, and it keeps the two lists in one place each.
    const payload = rows.map((r) => ({
      crm_company_id: r.crm_company_id,
      name: r.name ?? '',
      stage: r.stage,
      arr: Number(r.arr ?? 0),
      website: r.website ?? '',
      email: r.email ?? '',
      contact_name: r.contact_name ?? '',
    }));

    const res = await fetch(`${PEAK_FOCUS_URL}/rest/v1/rpc/crm_upsert_clients`, {
      method: 'POST',
      headers: {
        apikey: pfKey,
        Authorization: `Bearer ${pfKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_rows: payload, p_dry_run: dryRun }),
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`Peak Focus returned ${res.status}: ${text.slice(0, 500)}`);

    const report = JSON.parse(text) as PushReport;
    const counts = report.counts ?? {};

    await admin.from('peak_focus_push_runs').insert({
      dry_run: dryRun,
      ok: true,
      scoped: rows.length,
      inserted: counts.insert ?? 0,
      updated: counts.update ?? 0,
      unchanged: counts.unchanged ?? 0,
      excluded: counts.excluded ?? 0,
      report,
    });

    return json({ dry_run: dryRun, scoped: rows.length, counts, rows: report.rows });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    // Logged, not swallowed: a failed push that leaves no row is the bug this table exists
    // to prevent.
    await admin.from('peak_focus_push_runs').insert({ dry_run: dryRun, ok: false, detail });
    return json({ error: detail }, 500);
  }
});
