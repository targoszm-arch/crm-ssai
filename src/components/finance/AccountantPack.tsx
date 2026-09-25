import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as ChartTooltip, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { centsToEur, getVatPeriods, isExcludedFromAccounts } from "@/components/finance/financeUtils";
import {
  FinanceTransaction, FinanceVatReturn, useSetVatReturnStatus,
} from "@/components/finance/useFinanceTransactions";

/**
 * The accountant's monthly pack.
 *
 * This reproduces, from the transactions themselves, the four artefacts he
 * builds by hand in Google Sheets every period — VAT paid per month, invoices
 * paid per month, and the two pivot tables behind them — plus the figure he
 * actually files.
 *
 * The one thing it does NOT reproduce is his arithmetic. His sheet computed
 * VAT due as all output VAT minus all input VAT ever recorded, while noting
 * separately that two periods had already been submitted; that double-counts
 * the input VAT claimed in them. Everything here is per VAT3 period, so the
 * same mistake cannot be made: a period's figures come from the transactions
 * dated inside it and nothing else.
 */

// Validated against the data-viz checks (light surface #fcfcfb, dark #1a1a19):
// lightness band, chroma floor, CVD separation and contrast all pass.
const VAT_BLUE = "#2a78d6";
const PAID_ORANGE = "#eb6834";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** VAT as it goes on a VAT3: euro, converted, never the currency of the receipt. */
function vatEur(t: FinanceTransaction): number {
  return t.vat_eur_cents || t.vat_amount_cents || 0;
}
function amountEur(t: FinanceTransaction): number {
  return t.amount_eur_cents ?? t.amount_cents;
}

interface MonthRow {
  key: string;        // YYYY-MM, for sorting
  label: string;      // "May" or "May 26" once more than one year is in view
  vatPaid: number;
  invoicesPaid: number;
  vatCollected: number;
}

function buildMonths(txs: FinanceTransaction[]): MonthRow[] {
  const byMonth = new Map<string, MonthRow>();
  const years = new Set(txs.map(t => t.transaction_date.slice(0, 4)));

  for (const t of txs) {
    // A move between her own Revolut pockets is not a purchase and not a sale.
    // 179 of these were typed income or expense and put EUR 38,846 of internal
    // churn through both columns of the accountant's pivot.
    if (t.type === "transfer") continue;
    if (isExcludedFromAccounts(t)) continue;
    const key = t.transaction_date.slice(0, 7);
    if (!byMonth.has(key)) {
      const [y, m] = key.split("-");
      byMonth.set(key, {
        key,
        label: years.size > 1 ? `${MONTHS[Number(m) - 1]} ${y.slice(2)}` : MONTHS[Number(m) - 1],
        vatPaid: 0, invoicesPaid: 0, vatCollected: 0,
      });
    }
    const row = byMonth.get(key)!;
    if (t.type === "income") {
      row.vatCollected += t.vat_collected_cents || vatEur(t);
    } else if (t.type === "refund") {
      // A refund reduces what was paid. In the spreadsheet these were entered
      // as positive amounts in the "Invoices Paid" column, so June 2026 reads
      // EUR 2,232.69 where the money actually spent was EUR 2,091.10 — two
      // Vercel refunds of EUR 52.68 and EUR 88.91 added instead of deducted.
      // Neither carried VAT, so the VAT3 is unaffected; the expense total and
      // therefore the profit figure are not.
      row.invoicesPaid -= Math.abs(amountEur(t));
      row.vatPaid -= vatEur(t);
    } else {
      row.vatPaid += vatEur(t);
      row.invoicesPaid += Math.abs(amountEur(t));
    }
  }

  return [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** A single-series bar chart: one measure over time, titled so no legend is needed. */
function MonthlyBars({
  title, data, dataKey, color,
}: { title: string; data: MonthRow[]; dataKey: keyof MonthRow; color: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `€${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
            />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.4 }}
              formatter={(v: number) => [centsToEur(v * 100), title]}
            />
            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/** One of his pivot tables: a month column, a measure, and a grand total. */
function PivotTable({
  title, data, field,
}: { title: string; data: MonthRow[]; field: "vatPaid" | "vatCollected" }) {
  const total = data.reduce((s, r) => s + r[field], 0);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">{title}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(r => (
              <TableRow key={r.key}>
                <TableCell>{r.label}</TableCell>
                <TableCell className="text-right tabular-nums">{centsToEur(r[field])}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 font-semibold">
              <TableCell>Grand Total</TableCell>
              <TableCell className="text-right tabular-nums">{centsToEur(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface PeriodFigures {
  label: string;
  start: string;
  end: string;
  outputVat: number;
  inputVat: number;
  net: number;
  hasData: boolean;
  filed: FinanceVatReturn | undefined;
  isPast: boolean;
}

export function AccountantPack({
  allTxs, years, vatReturns,
}: {
  allTxs: FinanceTransaction[];
  years: number[];
  vatReturns: FinanceVatReturn[];
}) {
  const setStatus = useSetVatReturnStatus();

  const txs = useMemo(
    () => allTxs.filter(t => years.includes(Number(t.transaction_date.slice(0, 4)))),
    [allTxs, years],
  );
  const months = useMemo(() => buildMonths(txs), [txs]);

  // Charts want plain euro numbers, not cents.
  const chartData = useMemo(
    () => months.map(m => ({
      ...m,
      vatPaid: m.vatPaid / 100,
      invoicesPaid: m.invoicesPaid / 100,
      vatCollected: m.vatCollected / 100,
    })),
    [months],
  );

  const today = new Date().toISOString().slice(0, 10);

  const periods: PeriodFigures[] = useMemo(() => {
    const out: PeriodFigures[] = [];
    for (const year of [...years].sort((a, b) => a - b)) {
      for (const p of getVatPeriods(year)) {
        const inPeriod = allTxs.filter(t =>
          t.transaction_date >= p.start && t.transaction_date <= p.end && !isExcludedFromAccounts(t));
        const outputVat = inPeriod
          .filter(t => t.type === "income")
          .reduce((s, t) => s + (t.vat_collected_cents || vatEur(t)), 0);
        const inputVat = inPeriod
          // Purchases only. Was `type !== "income"`, which also caught
          // transfers; they carry no VAT today, so the figure happened to be
          // right, but the filter asserted something false.
          .filter(t => t.type === "expense" || t.type === "fee" || t.type === "refund")
          .reduce((s, t) => s + (t.type === "refund" ? -vatEur(t) : vatEur(t)), 0);
        out.push({
          label: `${p.label} ${year}`,
          start: p.start,
          end: p.end,
          outputVat,
          inputVat,
          net: outputVat - inputVat,
          hasData: inPeriod.length > 0,
          filed: vatReturns.find(r => r.period_start === p.start && r.period_end === p.end),
          isPast: p.end < today,
        });
      }
    }
    return out;
  }, [allTxs, years, vatReturns, today]);

  // The current period is the first one not yet over; that is the return being
  // prepared, and the only one the summary block should speak about.
  const current = periods.find(p => !p.isPast) ?? periods[periods.length - 1];

  // Input VAT already claimed in a return that has been filed. This is the
  // number the spreadsheet's blank "Offset" row was for, and deducting it a
  // second time is exactly the error that sheet made.
  const alreadyClaimed = periods
    .filter(p => p.filed?.status === "submitted" && p !== current)
    .reduce((s, p) => s + (p.filed?.filed_input_vat_cents ?? 0), 0);

  const missing = periods.filter(p => p.isPast && p.filed?.status !== "submitted");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlyBars title="VAT Paid per Month" data={chartData} dataKey="vatPaid" color={VAT_BLUE} />
        <MonthlyBars title="Invoices Paid per Month" data={chartData} dataKey="invoicesPaid" color={PAID_ORANGE} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PivotTable title="VAT Paid — currency converted" data={months} field="vatPaid" />
        <PivotTable title="VAT Collected" data={months} field="vatCollected" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">VAT3 by period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">VAT on sales (T1)</TableHead>
                <TableHead className="text-right">VAT on purchases (T2)</TableHead>
                <TableHead className="text-right">Net (T3 / T4)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.filter(p => p.hasData || p.isPast).map(p => {
                const filed = p.filed?.status === "submitted";
                // A filed row shows what was sent to Revenue, not what the
                // transactions say today. Storing the snapshot and then
                // rendering the live figure would have defeated the point:
                // classify one old receipt and a row still marked "Filed"
                // quietly shows a number nobody ever submitted.
                const shownOutput = filed ? (p.filed?.filed_output_vat_cents ?? p.outputVat) : p.outputVat;
                const shownInput = filed ? (p.filed?.filed_input_vat_cents ?? p.inputVat) : p.inputVat;
                const shownNet = filed ? (p.filed?.filed_net_cents ?? p.net) : p.net;
                // Drift matters — it is the case for a corrective return.
                const drift = filed ? p.net - shownNet : 0;
                return (
                  <TableRow key={p.label} className={cn(p === current && "bg-muted/40")}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {p.label}
                      {filed && <span className="ml-1 text-xs text-muted-foreground">as filed</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{centsToEur(shownOutput)}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      -{centsToEur(shownInput)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-semibold tabular-nums",
                      shownNet > 0 ? "text-rose-600" : shownNet < 0 ? "text-emerald-600" : "",
                    )}>
                      {centsToEur(shownNet)}
                      {drift !== 0 && (
                        <span className="block text-xs font-normal text-amber-600">
                          now {centsToEur(p.net)} ({drift > 0 ? "+" : ""}{centsToEur(drift)})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {filed ? (
                        <Badge className="bg-emerald-100 text-emerald-800">
                          Filed {p.filed?.submitted_on}
                        </Badge>
                      ) : !p.hasData ? (
                        <Badge variant="secondary">No data</Badge>
                      ) : (
                        <Badge className={p.net > 0 ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}>
                          {p.net > 0 ? "Payable" : "Repayable"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStatus.mutate({
                          period_start: p.start,
                          period_end: p.end,
                          status: filed ? "open" : "submitted",
                          outputVatCents: p.outputVat,
                          inputVatCents: p.inputVat,
                        })}
                      >
                        {filed ? "Reopen" : "Mark filed"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {current && (
            <div className="rounded-md border p-4">
              <p className="text-sm font-medium">{current.label} — the return being prepared</p>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-6">
                  <dt className="text-muted-foreground">VAT due (T1 − T2, this period only)</dt>
                  <dd className="font-semibold tabular-nums">{centsToEur(current.net)}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-muted-foreground">Offset</dt>
                  <dd className="tabular-nums">{centsToEur(0)}</dd>
                </div>
                <div className="flex justify-between gap-6 border-t pt-1">
                  <dt className="font-medium">Balance due</dt>
                  <dd className="text-lg font-bold tabular-nums">{centsToEur(current.net)}</dd>
                </div>
              </dl>
              {alreadyClaimed > 0 && (
                <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>
                    {centsToEur(alreadyClaimed)} of input VAT was claimed in returns already filed.
                    It is not deducted here — deducting it again is the error the spreadsheet made.
                    Only enter an Offset if Revenue carried a credit forward rather than repaying it.
                  </span>
                </p>
              )}
            </div>
          )}

          {missing.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                {missing.length} past {missing.length === 1 ? "period is" : "periods are"} not marked as filed
              </p>
              <ul className="mt-2 space-y-0.5 text-sm text-amber-900">
                {missing.map(p => (
                  <li key={p.label} className="flex justify-between gap-6">
                    <span>{p.label}</span>
                    <span className="tabular-nums">
                      {p.hasData ? centsToEur(p.net) : "no transactions recorded"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
