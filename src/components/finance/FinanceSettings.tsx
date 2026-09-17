import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Building2, Mail, Percent, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTaxRates, useUpdateTaxRate } from "@/components/finance/useFinanceTransactions";
import { RevolutConnect } from "@/components/finance/RevolutConnect";

/**
 * Finance settings.
 *
 * Two things live here, and they are deliberately different in kind.
 *
 * Tax rates are *data*: the names are fixed but the percentage changes when
 * Revenue changes it, so it is editable here and every transaction records
 * the percentage it was posted at. Editing a rate therefore never restates a
 * period that has already been filed.
 *
 * Connections are *secrets*, and secrets do not belong in a table the browser
 * can read — an API key in Postgres is one RLS mistake away from being public.
 * They live in Supabase Edge Function secrets. What this page adds is the
 * thing that was actually missing: a way to see, from inside the app, whether
 * each one is connected, and exactly which secret to set if it is not.
 */

type ConnState = "unknown" | "checking" | "connected" | "not_configured" | "error";

const CONNECTIONS = [
  {
    key: "stripe",
    label: "Stripe",
    fn: "sync-stripe-income",
    icon: CreditCard,
    secrets: ["STRIPE_SECRET_KEY"],
    help: "Stripe Dashboard → Developers → API keys → Secret key.",
  },
  {
    key: "revolut",
    label: "Revolut Business",
    fn: "sync-revolut",
    icon: Building2,
    secrets: [
      "REVOLUT_CLIENT_ID",
      "REVOLUT_PRIVATE_KEY",
      "REVOLUT_REFRESH_TOKEN",
      "REVOLUT_REDIRECT_URI",
    ],
    // Revolut Business has no static API key: access tokens last 40 minutes
    // and are minted per run from the refresh token plus a JWT signed with
    // the certificate's private key. Consent also lapses periodically, which
    // is why the CSV route stays a first-class option rather than a fallback.
    help: "Revolut Business → Settings → API. Upload the X509 certificate, then run the one-time code exchange to get the refresh token. Consent must be renewed periodically — CSV import needs none of this.",
  },
  {
    key: "gmail",
    label: "Gmail receipts",
    fn: "sync-gmail-receipts",
    icon: Mail,
    secrets: ["GMAIL_REFRESH_TOKEN", "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET"],
    help: "Google Cloud → OAuth2 credentials with the gmail.readonly scope.",
  },
] as const;

/**
 * The JSON body of a failed `functions.invoke`, or null.
 *
 * FunctionsHttpError carries the raw Response on `context`. Reading it is the
 * only way to see what the function actually said about a non-2xx, and a
 * function that answers 400 with a reason is being helpful, not broken.
 *
 * Returns null rather than throwing on anything unexpected — a relay error, a
 * network failure and an HTML error page all have no JSON body, and none of
 * them should turn a status check into an exception.
 */
async function readErrorBody(error: unknown): Promise<unknown | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof (context as Response).json !== "function") return null;
  try {
    return await (context as Response).clone().json();
  } catch {
    return null;
  }
}

function ConnectionRow({ conn }: { conn: (typeof CONNECTIONS)[number] }) {
  const [state, setState] = useState<ConnState>("unknown");
  const [detail, setDetail] = useState<string | null>(null);
  const Icon = conn.icon;

  // Asking the function itself is the only honest test: the client cannot see
  // Edge Function secrets, so anything else would be a guess.
  const check = async () => {
    setState("checking");
    setDetail(null);
    try {
      const { data, error } = await supabase.functions.invoke(conn.fn, { body: { limit: 1, days: 1 } });

      // The "not configured" branch used to read `data`, and never once fired.
      //
      // functions-js throws FunctionsHttpError on any non-2xx and returns
      // `{ data: null, error }` — the response body is NOT in `data`, it is on
      // `error.context`. So a function politely answering 400 with
      // `{"error":"not_configured"}` was reported as a red **Error** reading
      // "Edge Function returned a non-2xx status code", which is how an
      // unset STRIPE_SECRET_KEY looked like a broken deployment.
      //
      // Read the body off the error, then decide.
      const body = (data ?? (await readErrorBody(error))) as
        { error?: string; message?: string } | null;

      if (body?.error === "not_configured") {
        setState("not_configured");
        setDetail(body.message ?? null);
        return;
      }
      if (error) {
        setState("error");
        // Prefer the function's own message over the library's generic one.
        setDetail(body?.message ?? body?.error ?? error.message);
        return;
      }
      setState("connected");
      setDetail(null);
    } catch (e) {
      setState("error");
      setDetail(String(e));
    }
  };

  const badge = {
    unknown:        <Badge variant="secondary">Not checked</Badge>,
    checking:       <Badge variant="secondary">Checking…</Badge>,
    connected:      <Badge className="bg-emerald-100 text-emerald-800">Connected</Badge>,
    not_configured: <Badge className="bg-amber-100 text-amber-800">Not configured</Badge>,
    error:          <Badge className="bg-rose-100 text-rose-800">Error</Badge>,
  }[state];

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{conn.label}</span>
          {badge}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{conn.help}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Secret{conn.secrets.length > 1 ? "s" : ""}:{" "}
          {conn.secrets.map(s => <code key={s} className="mr-1 font-mono text-foreground">{s}</code>)}
        </p>
        {detail && <p className="mt-1 break-words text-xs text-amber-700">{detail}</p>}
      </div>
      <Button variant="outline" size="sm" onClick={check} disabled={state === "checking"} className="shrink-0">
        {state === "checking"
          ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
          : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
        Test connection
      </Button>
    </div>
  );
}

function TaxRateRow({ rate }: { rate: { id: string; name: string; percent: number; applies_to: string } }) {
  const [value, setValue] = useState(String(Number(rate.percent)));
  const update = useUpdateTaxRate();
  const dirty = Number(value) !== Number(rate.percent);

  const save = () => {
    const pct = Number(value);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("Enter a percentage between 0 and 100");
      setValue(String(Number(rate.percent)));
      return;
    }
    update.mutate(
      { id: rate.id, percent: pct },
      {
        onSuccess: () => toast.success(`${rate.name} set to ${pct}%`),
        onError: e => toast.error(`Could not save: ${String(e)}`),
      },
    );
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{rate.name}</TableCell>
      <TableCell className="text-xs capitalize text-muted-foreground">{rate.applies_to}</TableCell>
      <TableCell className="w-40">
        <div className="flex items-center gap-2">
          <Input
            type="number" min={0} max={100} step="0.001"
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={() => { if (dirty) save(); }}
            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="h-8 w-24"
          />
          <Percent className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function FinanceSettings() {
  const { data: rates = [], isLoading } = useTaxRates();

  return (
    <>
      <RevolutConnect />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Finance data sources</CardTitle>
          <CardDescription>
            Where income and expenses come from. Keys are stored as Supabase Edge Function
            secrets, never in the database — this page reports whether each one is set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {CONNECTIONS.map(c => <ConnectionRow key={c.key} conn={c} />)}
          <p className="text-xs text-muted-foreground">
            Set secrets in the Supabase dashboard under{" "}
            <span className="font-medium text-foreground">Edge Functions → Secrets</span> for project{" "}
            <code className="font-mono">getqcxnjsohtlagscmfc</code>, then re-test here.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tax rates</CardTitle>
          <CardDescription>
            Rate names are fixed; the percentage is editable. Each transaction stores the
            percentage it was posted at, so changing a rate here does not restate a VAT
            period you have already filed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tax rates configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead>Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map(r => <TaxRateRow key={r.id} rate={r} />)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
