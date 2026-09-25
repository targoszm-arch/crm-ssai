import { useState, useMemo, useRef, lazy, Suspense } from "react";
import type { GridApi } from "ag-grid-community";
import PageShell from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, RefreshCw, Download,
  Receipt, Percent, DollarSign, Info, Check, Trash2, Search,
  CreditCard, Mail, Building2, Copy, ChevronUp, ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceTransactions, useDeleteTransaction, useUpdateTransaction, useLastSynced, useTaxRates, useVatReturns, FinanceTransaction, FinanceTaxRate } from "@/components/finance/useFinanceTransactions";
import { AddTransactionDialog } from "@/components/finance/AddTransactionDialog";
import { ImportStatementDialog } from "@/components/finance/ImportStatementDialog";
import { DuplicateReviewDialog, DuplicateReviewItem } from "@/components/finance/DuplicateReviewDialog";
// Lazily loaded: AG Grid is ~800KB raw, and eagerly importing it put it in
// the main bundle, so every page — the login screen included — paid for a grid
// only Finances renders. Split out, it arrives when this tab does.
const FinanceGrid = lazy(() =>
  import("@/components/finance/FinanceGrid").then(m => ({ default: m.FinanceGrid })));
import { ReconcilePanel } from "@/components/finance/ReconcilePanel";
import { AccountantPack } from "@/components/finance/AccountantPack";
import { findDuplicateGroups, evidenceLostIfDeleted } from "@/components/finance/duplicateUtils";
import { describeSyncError } from "@/components/finance/functionError";
import { ReceiptReviewDialog } from "@/components/finance/ReceiptReviewDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  centsToEur, centsToNum, VAT_TREATMENT_LABELS, VAT_TREATMENT_COLORS,
  SOURCE_COLORS, TYPE_COLORS, CATEGORIES, getVatPeriods, exportToCsv,
  ACCOUNTING_CATEGORIES, ACCOUNTING_CATEGORY_LABELS, ACCOUNTING_CATEGORY_STATEMENT,
  STATEMENT_COLORS, isExcludedFromAccounts, DateRange, EMPTY_RANGE, inRange, rangeLabel } from "@/components/finance/financeUtils";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as ChartTooltip, Legend } from "recharts";
import { cn } from "@/lib/utils";
import { PageActions } from "@/components/layout/PageActions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MultiSelectFilter } from "@/components/customers/MultiSelectFilter";
import { DateRangeFilter } from "@/components/finance/DateRangeFilter";

// Kept next to the header so adding a column and forgetting the colSpans is
// a one-line fix rather than three silently mismatched numbers.
const COLUMN_COUNT = 20;


// ── Metric card (adapted from remix-of-financeflow MetricCard) ──────────────
function MetricCard({
  title, value, sub, icon, gradient, trend, trendLabel,
}: {
  title: string; value: string; sub?: string;
  icon: React.ReactNode;
  gradient?: "income" | "expense" | "vat" | "net";
  trend?: number; trendLabel?: string;
}) {
  const gradientCls = {
    income: "bg-gradient-to-br from-emerald-600 to-emerald-500 text-white",
    expense: "bg-gradient-to-br from-rose-600 to-rose-500 text-white",
    vat: "bg-gradient-to-br from-violet-600 to-violet-500 text-white",
    net: "bg-gradient-to-br from-sky-600 to-sky-500 text-white",
  };
  const cls = gradient ? gradientCls[gradient] : "bg-card";

  return (
    <Card className={cn("p-5 rounded-xl border shadow-md hover:shadow-lg transition-all", cls)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <p className={cn("text-sm font-medium", gradient ? "text-white/80" : "text-muted-foreground")}>{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {sub && <p className={cn("text-xs", gradient ? "text-white/70" : "text-muted-foreground")}>{sub}</p>}
          {trend !== undefined && (
            <div className={cn("flex items-center gap-1 text-sm font-medium", gradient ? "text-white/90" : trend >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
              {trendLabel && <span className={cn("font-normal text-xs", gradient ? "text-white/60" : "text-muted-foreground")}>{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className={cn("p-2 rounded-lg", gradient ? "bg-white/20" : "bg-muted")}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ── VAT summary row ────────────────────────────────────────────────────────

// ── Sortable column header ─────────────────────────────────────────────────

// ── Last-sync formatter ────────────────────────────────────────────────────
function formatLastSync(isoString: string | undefined): string {
  if (!isoString) return "Never";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
  return new Date(isoString).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}

// ── Data Sources status chip ────────────────────────────────────────────────
function SourceChip({
  icon, label, lastSync, actionLabel, onAction, loading,
}: {
  icon: React.ReactNode;
  label: string;
  lastSync: string | undefined;
  actionLabel: string;
  onAction: () => void;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        {formatLastSync(lastSync)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs ml-1"
        onClick={onAction}
        disabled={loading}
      >
        {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : actionLabel}
      </Button>
    </div>
  );
}

// ── Transaction row ────────────────────────────────────────────────────────

// ── Main page ──────────────────────────────────────────────────────────────
export default function FinancePage() {
  // Empty set = every year. Filtering is done in memory over the full
  // table, so changing the selection is instant and nothing is hidden
  // behind a refetch.
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [syncingRevolut, setSyncingRevolut] = useState(false);
  const [receiptReviewOpen, setReceiptReviewOpen] = useState(false);
  const [dupReviewOpen, setDupReviewOpen] = useState(false);
  const [dupWorking, setDupWorking] = useState(false);
  // Filters the table only, like type/source/category beside it. The year
  // filter in the header scopes the report; this answers "show me the rows
  // between these two dates" while looking at the list.
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);
  const qc = useQueryClient();

  // Unfiltered on purpose. Type and source are a way of looking at the
  // transactions table, not a statement about which money exists, and a VAT
  // return computed from a filtered ledger is simply wrong: pick "Expenses"
  // in the tab below and output VAT silently becomes zero. Worse, "Mark
  // filed" would then snapshot that as what was sent to Revenue. Both
  // filters are applied to the table and nowhere else.
  const { data: allTxs = [], isLoading } = useFinanceTransactions();
  const { data: lastSynced = {} } = useLastSynced();
  const { data: taxRates = [] } = useTaxRates();
  const { data: vatReturns = [] } = useVatReturns();
  // Years present in the data, derived from rows already in memory.
  const availableYears = useMemo(() => {
    const counts = new Map<number, number>();
    for (const t of allTxs) {
      const y = Number(t.transaction_date.slice(0, 4));
      if (!Number.isNaN(y)) counts.set(y, (counts.get(y) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => b - a)
      .map(([year, count]) => ({ year, count }));
  }, [allTxs]);

  // The ledger for the selected years: metrics, chart and the filing pack.
  const txs = useMemo(
    () => allTxs.filter(t =>
      selectedYears.size === 0 || selectedYears.has(Number(t.transaction_date.slice(0, 4)))),
    [allTxs, selectedYears],
  );

  // Label for headings: one year reads as that year, several as a list.
  const yearLabel = selectedYears.size === 0
    ? "all years"
    : [...selectedYears].sort((a, b) => a - b).join(", ");
  const deleteTx = useDeleteTransaction();
  const updateTx = useUpdateTransaction();

  // Suspected duplicates across everything stored, not just the visible year:
  // the pair that matters most is an imported 2025 row against a 2026 sync.
  const duplicateGroups = useMemo(() => findDuplicateGroups(allTxs), [allTxs]);
  const duplicateItems: DuplicateReviewItem[] = useMemo(
    () => duplicateGroups.flatMap(g => g.extras.map(extra => ({
      key: extra.id,
      candidate: {
        date: extra.transaction_date,
        who: extra.counterparty_name ?? extra.description ?? "—",
        amountCents: extra.amount_eur_cents ?? extra.amount_cents,
        currency: extra.currency,
        type: extra.type,
        note: `From ${extra.source}, added ${extra.created_at.slice(0, 10)}`
          + (extra.is_reconciled ? " · reconciled" : "")
          // Deleting is only safe when the row carries nothing the kept row
          // lacks. When it does, say so — the usual case is a Gmail receipt
          // holding the VAT and the PDF for a bank line that holds neither.
          + (evidenceLostIfDeleted(extra, g.keep).length
            ? ` · deleting loses its ${evidenceLostIfDeleted(extra, g.keep).join(", ")}`
            : ""),
      },
      matches: [{
        date: g.keep.transaction_date,
        who: g.keep.counterparty_name ?? g.keep.description ?? "—",
        amountCents: g.keep.amount_eur_cents ?? g.keep.amount_cents,
        currency: g.keep.currency,
        type: g.keep.type,
        note: `From ${g.keep.source}, added ${g.keep.created_at.slice(0, 10)}`
          + (g.keep.is_reconciled ? " · reconciled" : ""),
      }],
      certain: !!extra.source_id && extra.source_id === g.keep.source_id,
    }))),
    [duplicateGroups],
  );

  // Approve keeps the row; decline deletes it. Deleting is the irreversible
  // answer, so it is never the default and never applied in bulk without her
  // saying so in the dialog.
  const applyDuplicateDecisions = async (declined: Set<string>) => {
    if (declined.size === 0) { setDupReviewOpen(false); return; }
    setDupWorking(true);
    try {
      const { error } = await supabase
        .from("finance_transactions")
        .delete()
        .in("id", [...declined]);
      if (error) throw error;
      toast.success(`Removed ${declined.size} duplicate ${declined.size === 1 ? "row" : "rows"}`);
      qc.invalidateQueries({ queryKey: ["finance_transactions"] });
      setDupReviewOpen(false);
    } catch (e) {
      toast.error(`Could not remove: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setDupWorking(false);
    }
  };

  // Count unreconciled Gmail receipts for badge
  const { data: pendingReceipts = [] } = useQuery({
    queryKey: ["gmail-receipts-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("finance_transactions")
        .select("id")
        .eq("source", "gmail")
        .eq("is_reconciled", false);
      return data ?? [];
    },
  });

  // ── Summary metrics ────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const booked = txs.filter(t => !isExcludedFromAccounts(t));
    const income = booked.filter(t => t.type === "income");
    const expenses = booked.filter(t => t.type === "expense");
    const totalIncome = income.reduce((s, t) => s + (t.amount_eur_cents ?? t.amount_cents), 0);
    const totalExpenses = expenses.reduce((s, t) => s + (t.amount_eur_cents ?? t.amount_cents), 0);
    // Euro, for the same reason the period table uses it: `vat_amount_cents`
    // is VAT as the receipt states it, so summing it across a USD invoice and
    // a EUR one adds dollars to euro. These cards sat above a period table
    // that had already been fixed and quietly disagreed with it.
    const outputVat = income
      .filter(t => t.vat_treatment === "standard_23")
      .reduce((s, t) => s + (t.vat_collected_cents || t.vat_eur_cents || t.vat_amount_cents || 0), 0);
    const inputVat = expenses
      .filter(t => t.vat_treatment === "standard_23" || t.vat_treatment === "reduced_135")
      .reduce((s, t) => s + (t.vat_eur_cents || t.vat_amount_cents || 0), 0);
    const vatDue = outputVat - inputVat;
    const netProfit = totalIncome - totalExpenses;
    return { totalIncome, totalExpenses, vatDue, netProfit, outputVat, inputVat };
  }, [txs]);

  // ── Monthly bar chart data ─────────────────────────────────────────────
  // One year selected reads as Jan–Dec; several read as a continuous run of
  // months across them, so a year boundary is visible rather than folded
  // over itself.
  const chartData = useMemo(() => {
    const years = selectedYears.size > 0
      ? [...selectedYears].sort((a, b) => a - b)
      : availableYears.map(y => y.year).sort((a, b) => a - b);
    if (years.length === 0) return [];

    const multi = years.length > 1;
    const buckets: { month: string; Income: number; Expenses: number }[] = [];

    for (const y of years) {
      for (let i = 0; i < 12; i++) {
        const key = `${y}-${String(i + 1).padStart(2, "0")}`;
        const inMonth = txs.filter(t => t.transaction_date.startsWith(key) && !isExcludedFromAccounts(t));
        const short = new Date(y, i, 1).toLocaleString("en-IE", { month: "short" });
        buckets.push({
          month: multi ? `${short} ${String(y).slice(2)}` : short,
          Income: centsToNum(inMonth.filter(t => t.type === "income")
            .reduce((s, t) => s + (t.amount_eur_cents ?? t.amount_cents), 0)),
          Expenses: centsToNum(inMonth.filter(t => t.type === "expense")
            .reduce((s, t) => s + (t.amount_eur_cents ?? t.amount_cents), 0)),
        });
      }
    }
    return buckets;
  }, [txs, selectedYears, availableYears]);

  // The grid hands its API up so the row count and the CSV reflect what is
  // actually on screen — the same rows, in the same order.
  // The summary — four metric cards and a 240px chart — is ~330px of fixed
  // height sitting directly above a 1,000-row ledger on a fill-height page.
  // Everything above the grid is shrink-0, so that 330px comes straight out
  // of the grid, which is the thing you actually work in. Collapsed by
  // default; the choice is remembered.
  const [summaryOpen, setSummaryOpen] = useState(() => {
    try { return localStorage.getItem("finance.summaryOpen") === "1"; } catch { return false; }
  });
  const toggleSummary = () => {
    setSummaryOpen(v => {
      try { localStorage.setItem("finance.summaryOpen", v ? "0" : "1"); } catch { /* private mode */ }
      return !v;
    });
  };

  const gridApiRef = useRef<GridApi<FinanceTransaction> | null>(null);
  const [displayedCount, setDisplayedCount] = useState<number | null>(null);

  // ── Filtered rows handed to the grid ─────────────────────────────────────
  const filteredTxs = useMemo(() => {
    let rows = txs;
    if (dateRange.from || dateRange.to) rows = rows.filter(t => inRange(t.transaction_date, dateRange));
    if (typeFilter !== "all") rows = rows.filter(t => t.type === typeFilter);
    if (sourceFilter !== "all") rows = rows.filter(t => t.source === sourceFilter);
    if (categoryFilter !== "all") rows = rows.filter(t => t.accounting_category === categoryFilter);
    // Search is NOT applied here. It used to be — over description, counterparty
    // name and email — while the grid ALSO applied it as a quick filter across
    // every column, so two different predicates ran in series: the toolbar
    // counted this array and the grid displayed a subset of it, and the two
    // numbers disagreed. The grid's filter is the wider of the two and it is
    // the one that decides what you can see, so it is the only one now.
    //
    // No sort here either. The grid owns sorting, on every column rather than
    // the five the old switch handled, and sorting in both places would fight.
    return rows;
  }, [txs, dateRange, typeFilter, sourceFilter, categoryFilter]);

  // ── Sync to current ───────────────────────────────────────────────────
  // A sync starts a few days before the newest row already stored for that
  // source, not from the start of history. Re-pulling everything re-inserted
  // rows she had deleted (pocket-to-pocket transfers) and was slower for no
  // gain. Three days of overlap catch transactions that completed after the
  // last sync. Deleted rows are also tombstoned server-side, so the overlap
  // cannot bring those back either. With nothing stored yet, the whole history.
  const syncStartFor = (
    source: string,
    fallback: string,
    overlapDays = 3,
    include: (t: FinanceTransaction) => boolean = () => true,
  ): string => {
    const latest = allTxs
      .filter(t => t.source === source && include(t))
      .reduce<string | null>((m, t) => (m === null || t.transaction_date > m ? t.transaction_date : m), null);
    if (!latest) return fallback;
    const d = new Date(`${latest}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - overlapDays);
    return d.toISOString().slice(0, 10);
  };

  // ── Stripe sync ────────────────────────────────────────────────────────
  const handleStripeSync = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      // Anchored on charges only: a charge row's date is Stripe's `created`,
      // the same field `created[gte]` filters on, whereas a payout row's date
      // is its arrival date and would push the window past charges created
      // before it. Fourteen days of overlap because the function keeps only
      // succeeded charges, and a bank-debit charge can take that long to
      // succeed after it is created; a shorter window would skip it forever.
      const since = syncStartFor("stripe", "2025-01-01", 14, t => !(t.source_id ?? "").startsWith("payout_"));
      const { data: fnData, error } = await supabase.functions.invoke("sync-stripe-income", {
        body: { since_timestamp: Math.floor(new Date(`${since}T00:00:00Z`).getTime() / 1000) },
      });
      if (error) throw error;
      toast.success(`Synced ${fnData.synced} Stripe transactions`);
    } catch (err) {
      const { notConfigured, message } = await describeSyncError(err);
      if (notConfigured) toast.warning(`Stripe is not connected. ${message}`, { duration: 10000 });
      else toast.error(`Stripe sync failed: ${message}`);
    } finally {
      setSyncing(false);
    }
  };

  // ── Revolut sync ──────────────────────────────────────────────────────
  const handleRevolutSync = async () => {
    setSyncingRevolut(true);
    try {
      const from = syncStartFor("revolut", "2025-01-01");
      const { data: fnData, error } = await supabase.functions.invoke("sync-revolut", { body: { from } });
      if (error) throw error;
      toast.success(`Revolut synced from ${from}: ${fnData.synced} checked`
        + (fnData.deleted_skipped ? `, ${fnData.deleted_skipped} you deleted kept out` : ""));
    } catch (err) {
      const { notConfigured, message } = await describeSyncError(err);
      if (notConfigured) toast.warning(`Revolut is not connected. ${message}`, { duration: 10000 });
      else toast.error(`Revolut sync failed: ${message}`);
    } finally {
      setSyncingRevolut(false);
    }
  };

  // ── Gmail sync ────────────────────────────────────────────────────────
  const handleGmailSync = async () => {
    setSyncingGmail(true);
    try {
      const { data: fnData, error } = await supabase.functions.invoke("sync-gmail-receipts", {});
      if (error) throw error;
      // The harvest walks back to April 2025 and stops on a time budget, so
      // "not finished" is a normal outcome and has to be said out loud —
      // otherwise a partial run reads as a complete one.
      if (fnData.done === false) {
        toast.warning(fnData.message ?? "Time limit reached — run it again to continue.", {
          duration: 10000,
        });
      } else {
        toast.success(`Gmail: ${fnData.synced} new receipts (${fnData.skipped} skipped)`);
      }
      if (fnData.synced > 0) setReceiptReviewOpen(true);
    } catch (err) {
      const { notConfigured, message } = await describeSyncError(err);
      if (notConfigured) toast.warning(`Gmail is not connected. ${message}`, { duration: 10000 });
      else toast.error(`Gmail sync failed: ${message}`);
    } finally {
      setSyncingGmail(false);
    }
  };

  // ── Refresh all ───────────────────────────────────────────────────────
  // The two money feeds only. The ledger is what Revolut and Stripe report
  // (25 Sep 2026); Gmail receipts are documents, and harvesting them on every
  // refresh put 323 of them back an hour after they were cleared out. The
  // Gmail card keeps its own button for when she wants them.
  const handleRefreshAll = async () => {
    await Promise.all([handleStripeSync(), handleRevolutSync()]);
  };

  // ── CSV export ─────────────────────────────────────────────────────────
  const handleExport = () => {
    // Walk the grid's displayed nodes rather than `filteredTxs`: the grid owns
    // sorting and the quick filter, so the array the page holds is neither in
    // the order on screen nor the same set of rows. Exporting it produced a
    // file that did not match what the person was looking at.
    const api = gridApiRef.current;
    const source: FinanceTransaction[] = [];
    if (api) {
      api.forEachNodeAfterFilterAndSort(n => { if (n.data) source.push(n.data); });
    }
    const rows = (source.length ? source : filteredTxs).map(t => ({
      Date: t.transaction_date,
      Supplier: t.counterparty_name ?? "",
      Subject: t.subject ?? t.description ?? "",
      "Accounting Category": t.accounting_category
        ? (ACCOUNTING_CATEGORY_LABELS[t.accounting_category] ?? t.accounting_category)
        : "",
      "Tax Rate": t.tax_rate_name ?? "",
      "Tax Rate %": t.tax_rate_percent ?? "",
      "Invoice Amount": t.amount_cents / 100,
      "Invoices Paid": t.amount_eur_cents == null ? "" : t.amount_eur_cents / 100,
      "VAT Paid": (t.vat_amount_cents ?? 0) / 100,
      "VAT - Curr conv": (t.vat_eur_cents ?? 0) / 100,
      Currency: t.currency,
      "VAT Collected": (t.vat_collected_cents ?? 0) / 100,
      Type: t.type,
      Source: t.source,
      Filename: t.receipt_filename ?? "",
      Size: t.receipt_size ?? "",
      "Drive link": t.drive_url ?? "",
      "Gmail link": t.gmail_url ?? "",
      Mailbox: t.mailbox ?? "",
      Notes: t.notes ?? "",
      Reconciled: t.is_reconciled ? "yes" : "no",
    }));
    exportToCsv(rows, `skillstudio-finance-${yearLabel.replace(/[^0-9]+/g, "-")}.csv`);
    toast.success("CSV exported");
  };

  return (
    // One scrollbar, not two. This page used to grow past the viewport (the
    // page scrolled) AND cap the table at 70vh (the table scrolled), so
    // reaching the bottom of the page meant scrolling the table first — the
    // scroll wheel did different things depending on where the pointer was.
    //
    // Now the page fills the shell and does not scroll; the table is the only
    // thing that does. That is also what lets the header stick: a sticky thead
    // pins against its NEAREST scrollport, so with two of them it pinned to the
    // inner one and appeared not to work at all.
    <PageShell variant="fill">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-4">
        <PageActions>
          <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={syncing || syncingGmail || syncingRevolut}>
            <RefreshCw className={cn("h-4 w-4 mr-2", (syncing || syncingGmail || syncingRevolut) && "animate-spin")} />
            {(syncing || syncingGmail || syncingRevolut) ? "Syncing…" : "Sync to current"}
          </Button>
          {pendingReceipts.length > 0 && (
            <Button size="sm" onClick={() => setReceiptReviewOpen(true)}>
              <Receipt className="h-4 w-4 mr-2" />
              Review receipts ({pendingReceipts.length})
            </Button>
          )}
          {duplicateItems.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setDupReviewOpen(true)}>
              <Copy className="h-4 w-4 mr-2" />
              Review duplicates ({duplicateItems.length})
            </Button>
          )}
          <AddTransactionDialog />
          <ImportStatementDialog />
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </PageActions>

        <PageHeader
          title="Finance & Tax"
          description="Reconcile income, expenses and VAT for your Irish tax return"
        />

        {/* Data Sources status bar. Folded into the summary toggle: it is
            sync status, not something you work in, and on a fill-height page
            every fixed row above the ledger is a row taken off the ledger. */}
        {summaryOpen && <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Data sources</span>
          <SourceChip
            icon={<CreditCard className="h-3.5 w-3.5" />}
            label="Stripe"
            lastSync={lastSynced["stripe"]}
            actionLabel="Sync"
            onAction={handleStripeSync}
            loading={syncing}
          />
          <SourceChip
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Revolut"
            lastSync={lastSynced["revolut"]}
            actionLabel="Sync"
            onAction={handleRevolutSync}
            loading={syncingRevolut}
          />
          <SourceChip
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Gmail"
            lastSync={lastSynced["gmail"]}
            actionLabel="Scan receipts"
            onAction={handleGmailSync}
            loading={syncingGmail}
          />
        </div>}
      </div>

      <ReceiptReviewDialog open={receiptReviewOpen} onClose={() => setReceiptReviewOpen(false)} />

      <DuplicateReviewDialog
        open={dupReviewOpen}
        onOpenChange={setDupReviewOpen}
        title="Possible duplicates"
        description={
          "These rows share a date, an amount and a counterparty with another row you "
          + "already have. That is a filter, not a verdict — two genuine identical payments "
          + "on one day look exactly like this. Keep the ones that are real; delete the "
          + "ones that are the same money recorded twice."
        }
        items={duplicateItems}
        approveLabel="Keep"
        declineLabel="Delete"
        defaultDecision="approve"
        busy={dupWorking}
        onConfirm={declined => { void applyDuplicateDecisions(declined); }}
      />

      {/* Metric cards (FinanceFlow style) */}
      {summaryOpen && <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Income"
          value={centsToEur(metrics.totalIncome)}
          sub={`${yearLabel} gross`}
          gradient="income"
          icon={<ArrowUpRight className="w-5 h-5 text-white" />}
        />
        <MetricCard
          title="Total Expenses"
          value={centsToEur(metrics.totalExpenses)}
          sub={`${yearLabel} gross`}
          gradient="expense"
          icon={<ArrowDownLeft className="w-5 h-5 text-white" />}
        />
        <MetricCard
          title="VAT Due / Refund"
          value={centsToEur(Math.abs(metrics.vatDue))}
          sub={metrics.vatDue >= 0 ? "payable to Revenue" : "refund from Revenue"}
          gradient="vat"
          icon={<Percent className="w-5 h-5 text-white" />}
        />
        <MetricCard
          title="Net Profit"
          value={centsToEur(metrics.netProfit)}
          sub={`${yearLabel} pre-tax`}
          gradient="net"
          icon={<DollarSign className="w-5 h-5 text-white" />}
        />
      </div>}

      {/* Revenue / Expenses bar chart */}
      {summaryOpen && <Card className="shrink-0">
        <CardHeader>
          <CardTitle className="text-base">Monthly Income vs Expenses ({yearLabel})</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <ChartTooltip formatter={(v: number) => `€${v.toFixed(2)}`} />
              <Legend />
              <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>}

      {/* Tabs */}
      {/* min-h is load-bearing, not padding. Everything above this — header,
          metric cards, chart, tab strip — is shrink-0, so the tabs region is
          the only thing that can absorb a short viewport, and `flex-1
          min-h-0` lets it absorb all the way to zero. On a laptop that put the
          table at zero height: the shell would still scroll the cards into
          view, but there were no rows left to reveal.

          The floor now lives on the TABLE, not on this region, and it is
          60svh rather than a rem value. That is the difference between a
          table whose height is whatever is left over after everything else
          has taken its share — which is how it ended up five rows tall — and
          one that is guaranteed most of the screen no matter what sits above
          it. If the total then exceeds the viewport, the page scrolls. That
          is the honest outcome, and it is bounded: the summary above the
          table is collapsed by default.

          With a floor, a viewport too short to fit everything overflows the
          shell and the page scrolls — which is the honest outcome, since
          something has to scroll when the content genuinely does not fit.
          Above that height there is still exactly one scrollbar: the table's.

          Note this element does NOT also carry min-h-0, unlike its children:
          the two are contradictory, and Tailwind would resolve the conflict by
          CSS source order rather than by the order written here. The children
          keep min-h-0 so the table can still scroll inside whatever height
          this resolves to. */}
      <Tabs defaultValue="transactions" className="flex flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <TabsList className="self-start">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="reconcile">Reconcile</TabsTrigger>
            <TabsTrigger value="vat">VAT Report</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
          <MultiSelectFilter
              label="years"
              placeholder="All years"
              className="w-[180px]"
              options={availableYears.map(y => ({
                value: String(y.year),
                label: `${y.year} (${y.count})`,
              }))}
              selectedValues={[...selectedYears].map(String)}
              onChange={vals => setSelectedYears(new Set(vals.map(Number)))}
            />
          <Button variant="ghost" size="sm" onClick={toggleSummary} className="gap-1.5">
            {summaryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {summaryOpen ? "Hide summary" : "Show summary"}
          </Button>
          </div>
        </div>

        {/* ── Transactions tab ──────────────────────────────────────────── */}
        <TabsContent value="transactions" className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
          {/* Filter + Group row */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search…"
                className="pl-9 w-52"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <DateRangeFilter value={dateRange} onChange={setDateRange} />

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
                <SelectItem value="fee">Fee</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="revolut">Revolut</SelectItem>
                <SelectItem value="n26">N26</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="gmail">Gmail receipts</SelectItem>
                <SelectItem value="receipt_log">Receipt log</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {ACCOUNTING_CATEGORIES.map(g => (
                  <SelectGroup key={g.group}>
                    <SelectLabel className="text-xs">{g.group}</SelectLabel>
                    {g.options.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            {/* The "Group by" control is gone, not hidden. Row grouping is an
                AG Grid Enterprise feature; on Community the dropdown would sit
                there doing nothing, which is worse than its absence. With a
                licence it returns as `rowGroup: true` on the column plus a
                grouping panel — a few lines, not a rebuild. */}

            <span className="ml-auto text-sm text-muted-foreground whitespace-nowrap">
              {(displayedCount ?? filteredTxs.length).toLocaleString()} row
              {(displayedCount ?? filteredTxs.length) !== 1 ? "s" : ""}
            </span>
          </div>

          <Card className="flex min-h-[60svh] flex-1 flex-col overflow-hidden">
            <Suspense fallback={
              <div className="flex h-full items-center justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            }>
              <FinanceGrid
                rows={filteredTxs}
                taxRates={taxRates}
                search={search}
                onGridReady={api => { gridApiRef.current = api; }}
                onDisplayedRowsChanged={setDisplayedCount}
              />
            </Suspense>
          </Card>
        </TabsContent>

        {/* ── VAT Report tab ─────────────────────────────────────────────── */}
        {/* Reconcile: the two passes that still need a person's eye — which
            supplier a row belongs to, and which receipt documents it. Fed the
            unfiltered ledger on purpose; the toolbar filters above belong to
            the transactions table, and a filtered view here would silently
            hide half the work. */}
        <TabsContent value="reconcile" className="mt-4">
          <ReconcilePanel txs={allTxs} />
        </TabsContent>

        <TabsContent value="vat" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">Output VAT (collected)</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">{centsToEur(metrics.outputVat)}</p>
              <p className="text-xs text-muted-foreground mt-1">VAT charged on IE/EU B2C sales</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">Input VAT (reclaimable)</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{centsToEur(metrics.inputVat)}</p>
              <p className="text-xs text-muted-foreground mt-1">VAT paid on Irish business expenses</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">Net VAT due to Revenue</p>
              <p className={cn("text-2xl font-bold mt-1", metrics.vatDue >= 0 ? "text-rose-600" : "text-emerald-600")}>
                {centsToEur(Math.abs(metrics.vatDue))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.vatDue >= 0 ? "Payable via VAT3 on ROS" : "Refund due"}
              </p>
            </Card>
          </div>

          {/* His four artefacts, plus the per-period figures and the filing
              ledger that keep the Offset row honest. */}
          <AccountantPack
            allTxs={allTxs}
            years={selectedYears.size > 0 ? [...selectedYears] : availableYears.map(y => y.year)}
            vatReturns={vatReturns}
          />

          <Card className="p-5 bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Irish Tax Filing Checklist
            </h3>
            <ul className="space-y-1.5 text-sm text-blue-800">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" /><span><strong>VAT3 returns</strong> — file bi-monthly via ROS (Revenue Online Service), due 23rd of following month</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" /><span><strong>Form 11</strong> — Income Tax return for self-employed, due 31 October (or 13 Nov for ROS)</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" /><span><strong>EU B2B</strong> — confirm VAT numbers via VIES; apply reverse charge (0% output VAT)</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" /><span><strong>PRSI/USC</strong> — Class S PRSI (4%) + USC on net profit; pay with income tax via ROS</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" /><span><strong>Stripe fees &amp; PayPal</strong> — deductible as business expenses</span></li>
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
