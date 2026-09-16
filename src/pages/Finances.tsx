import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, RefreshCw, Download,
  Receipt, Percent, DollarSign, Info, Check, Trash2, Search,
  ChevronUp, ChevronDown, ChevronsUpDown, Layers, CreditCard, Mail, Building2, Copy
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceTransactions, useDeleteTransaction, useUpdateTransaction, useLastSynced, useTaxRates, useVatReturns, FinanceTransaction, FinanceTaxRate } from "@/components/finance/useFinanceTransactions";
import { AddTransactionDialog } from "@/components/finance/AddTransactionDialog";
import { ImportStatementDialog } from "@/components/finance/ImportStatementDialog";
import { DuplicateReviewDialog, DuplicateReviewItem } from "@/components/finance/DuplicateReviewDialog";
import { AccountantPack } from "@/components/finance/AccountantPack";
import { findDuplicateGroups } from "@/components/finance/duplicateUtils";
import { ReceiptReviewDialog } from "@/components/finance/ReceiptReviewDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  centsToEur, centsToNum, VAT_TREATMENT_LABELS, VAT_TREATMENT_COLORS,
  SOURCE_COLORS, TYPE_COLORS, CATEGORIES, getVatPeriods, exportToCsv,
  ACCOUNTING_CATEGORIES, ACCOUNTING_CATEGORY_LABELS, ACCOUNTING_CATEGORY_STATEMENT,
  STATEMENT_COLORS
} from "@/components/finance/financeUtils";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as ChartTooltip, Legend } from "recharts";
import { cn } from "@/lib/utils";
import { PageActions } from "@/components/layout/PageActions";
import { YearFilter } from "@/components/finance/YearFilter";

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
type SortField = "date" | "amount" | "customer" | "category" | "type";
type SortDir = "asc" | "desc";
type GroupBy = "none" | "category" | "type" | "customer" | "month";

// ── Sortable column header ─────────────────────────────────────────────────
function SortHead({
  field, label, sortField, sortDir, onSort, className,
}: {
  field: SortField; label: string; sortField: SortField; sortDir: SortDir;
  onSort: (f: SortField) => void; className?: string;
}) {
  const active = sortField === field;
  return (
    <TableHead
      className={cn("cursor-pointer select-none whitespace-nowrap", className)}
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5 text-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-primary" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </span>
    </TableHead>
  );
}

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
function TxRow({ tx, updateTx, deleteTx, taxRates }: {
  tx: FinanceTransaction;
  updateTx: ReturnType<typeof useUpdateTransaction>;
  deleteTx: ReturnType<typeof useDeleteTransaction>;
  taxRates: FinanceTaxRate[];
}) {
  const statement = tx.accounting_category
    ? ACCOUNTING_CATEGORY_STATEMENT[tx.accounting_category]
    : undefined;

  // Picking a rate stores the name *and* the percentage as it stands today.
  const setTaxRate = (name: string) => {
    const rate = taxRates.find(r => r.name === name);
    updateTx.mutate({
      id: tx.id,
      tax_rate_name: name,
      tax_rate_percent: rate ? Number(rate.percent) : null,
    });
  };

  const money = (cents: number | null | undefined, dash = true) =>
    cents == null || (cents === 0 && dash) ? "—" : centsToEur(cents);

  return (
    <TableRow>
      <TableCell className="text-sm font-medium whitespace-nowrap">{tx.transaction_date}</TableCell>

      <TableCell className="max-w-[160px]">
        <span className="text-sm truncate block">{tx.counterparty_name ?? "—"}</span>
        {tx.counterparty_country && (
          <span className="text-xs text-muted-foreground">{tx.counterparty_country}</span>
        )}
      </TableCell>

      <TableCell className="max-w-[260px]">
        <span className="text-sm truncate block" title={tx.subject ?? tx.description ?? ""}>
          {tx.subject ?? tx.description ?? "—"}
        </span>
      </TableCell>

      {/* Accounting category — fixed chart of accounts, so a Select, not an input. */}
      <TableCell>
        <Select
          value={tx.accounting_category ?? ""}
          onValueChange={v => updateTx.mutate({ id: tx.id, accounting_category: v })}
        >
          <SelectTrigger className="h-8 w-[190px] text-xs">
            <SelectValue placeholder="Unposted" />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {ACCOUNTING_CATEGORIES.map(g => (
              <SelectGroup key={g.group}>
                <SelectLabel className="text-xs">{g.group}</SelectLabel>
                {g.options.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        {statement && (
          <Badge variant="secondary" className={cn("mt-1 text-[10px]", STATEMENT_COLORS[statement])}>
            {statement === "pl" ? "P&L" : statement === "cogs" ? "COGS" : statement}
          </Badge>
        )}
      </TableCell>

      {/* Tax rate — name is chosen here, the percentage is edited in Settings. */}
      <TableCell>
        <Select value={tx.tax_rate_name ?? ""} onValueChange={setTaxRate}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue placeholder="No rate" />
          </SelectTrigger>
          <SelectContent>
            {taxRates.map(r => (
              <SelectItem key={r.id} value={r.name} className="text-xs">
                {r.name} ({Number(r.percent)}%)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tx.tax_rate_name && (
          <span className="mt-1 block text-[10px] text-muted-foreground">
            posted at {Number(tx.tax_rate_percent ?? 0)}%
          </span>
        )}
      </TableCell>

      <TableCell className={cn("text-right text-sm font-semibold whitespace-nowrap", TYPE_COLORS[tx.type])}>
        {tx.type === "expense" || tx.type === "fee" ? "-" : ""}{money(tx.amount_cents)}
      </TableCell>
      <TableCell className="text-right text-sm whitespace-nowrap">{money(tx.amount_eur_cents)}</TableCell>
      <TableCell className="text-right text-sm whitespace-nowrap">{money(tx.vat_amount_cents)}</TableCell>
      <TableCell className="text-right text-sm whitespace-nowrap">{money(tx.vat_eur_cents)}</TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{tx.currency}</TableCell>
      <TableCell className="text-right text-sm whitespace-nowrap text-emerald-700">
        {money(tx.vat_collected_cents)}
      </TableCell>

      <TableCell>
        <span className={cn("text-sm font-medium capitalize", TYPE_COLORS[tx.type])}>{tx.type}</span>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={cn("capitalize text-xs", SOURCE_COLORS[tx.source])}>
          {tx.source === "receipt_log" ? "receipt log" : tx.source}
        </Badge>
      </TableCell>

      <TableCell className="max-w-[180px]">
        <span className="text-xs truncate block" title={tx.receipt_filename ?? ""}>
          {tx.receipt_filename ?? "—"}
        </span>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{tx.receipt_size ?? "—"}</TableCell>

      {/* The two links are the whole point of the log: reconciling a row means
          opening the document, so they are one click from the row. */}
      <TableCell>
        {tx.drive_url ? (
          <a href={tx.drive_url} target="_blank" rel="noreferrer"
             className="text-xs text-primary hover:underline whitespace-nowrap">Drive ↗</a>
        ) : <span className="text-muted-foreground text-xs">—</span>}
      </TableCell>
      <TableCell>
        {tx.gmail_url ? (
          <a href={tx.gmail_url} target="_blank" rel="noreferrer"
             className="text-xs text-primary hover:underline whitespace-nowrap">Gmail ↗</a>
        ) : <span className="text-muted-foreground text-xs">—</span>}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{tx.mailbox ?? "—"}</TableCell>

      <TableCell className="max-w-[200px]">
        <span className="text-xs text-muted-foreground truncate block" title={tx.notes ?? ""}>
          {tx.notes ?? "—"}
        </span>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-1">
          {!tx.is_reconciled ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => updateTx.mutate({ id: tx.id, is_reconciled: true })}>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark reconciled</TooltipContent>
            </Tooltip>
          ) : (
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-xs">Reconciled</Badge>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => { if (confirm("Delete this transaction?")) deleteTx.mutate(tx.id); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

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
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [syncing, setSyncing] = useState(false);
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [syncingRevolut, setSyncingRevolut] = useState(false);
  const [receiptReviewOpen, setReceiptReviewOpen] = useState(false);
  const [dupReviewOpen, setDupReviewOpen] = useState(false);
  const [dupWorking, setDupWorking] = useState(false);
  const qc = useQueryClient();

  const { data: allTxs = [], isLoading } = useFinanceTransactions({ type: typeFilter, source: sourceFilter });
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

  // Everything downstream — metrics, chart, VAT, table — reads this.
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
          + (extra.is_reconciled ? " · reconciled" : ""),
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

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  // ── Summary metrics ────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const income = txs.filter(t => t.type === "income");
    const expenses = txs.filter(t => t.type === "expense");
    const totalIncome = income.reduce((s, t) => s + (t.amount_eur_cents ?? t.amount_cents), 0);
    const totalExpenses = expenses.reduce((s, t) => s + (t.amount_eur_cents ?? t.amount_cents), 0);
    const outputVat = income
      .filter(t => t.vat_treatment === "standard_23")
      .reduce((s, t) => s + (t.vat_amount_cents ?? 0), 0);
    const inputVat = expenses
      .filter(t => t.vat_treatment === "standard_23" || t.vat_treatment === "reduced_135")
      .reduce((s, t) => s + (t.vat_amount_cents ?? 0), 0);
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
        const inMonth = txs.filter(t => t.transaction_date.startsWith(key));
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

  // ── Filtered + searched + sorted rows ────────────────────────────────────
  const filteredTxs = useMemo(() => {
    let rows = txs;
    if (categoryFilter !== "all") rows = rows.filter(t => t.accounting_category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(t =>
        (t.description ?? "").toLowerCase().includes(q) ||
        (t.counterparty_name ?? "").toLowerCase().includes(q) ||
        (t.counterparty_email ?? "").toLowerCase().includes(q)
      );
    }
    // sort
    rows = [...rows].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortField) {
        case "date":     av = a.transaction_date; bv = b.transaction_date; break;
        case "amount":   av = a.amount_eur_cents ?? a.amount_cents; bv = b.amount_eur_cents ?? b.amount_cents; break;
        case "customer": av = (a.counterparty_name ?? "").toLowerCase(); bv = (b.counterparty_name ?? "").toLowerCase(); break;
        case "category": av = (a.accounting_category ?? "").toLowerCase(); bv = (b.accounting_category ?? "").toLowerCase(); break;
        case "type":     av = a.type; bv = b.type; break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [txs, search, categoryFilter, sortField, sortDir]);

  // ── Grouped rows ──────────────────────────────────────────────────────────
  const groupedRows = useMemo(() => {
    if (groupBy === "none") return null;
    const getKey = (t: FinanceTransaction) => {
      switch (groupBy) {
        case "category": return t.accounting_category
          ? (ACCOUNTING_CATEGORY_LABELS[t.accounting_category] ?? t.accounting_category)
          : "Unposted";
        case "type":     return t.type.charAt(0).toUpperCase() + t.type.slice(1);
        case "customer": return t.counterparty_name ?? "Unknown";
        case "month":    return t.transaction_date.slice(0, 7); // YYYY-MM
      }
    };
    const map = new Map<string, FinanceTransaction[]>();
    for (const t of filteredTxs) {
      const k = getKey(t)!;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTxs, groupBy]);

  // ── Stripe sync ────────────────────────────────────────────────────────
  const handleStripeSync = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { data: fnData, error } = await supabase.functions.invoke("sync-stripe-income", {
        body: { limit: 100 },
      });
      if (error) throw error;
      toast.success(`Synced ${fnData.synced} Stripe transactions`);
    } catch (err) {
      toast.error(`Stripe sync failed: ${String(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  // ── Revolut sync ──────────────────────────────────────────────────────
  const handleRevolutSync = async () => {
    setSyncingRevolut(true);
    try {
      const { data: fnData, error } = await supabase.functions.invoke("sync-revolut", { body: { days: 90 } });
      if (error) throw error;
      toast.success(`Synced ${fnData.synced} Revolut transactions`);
    } catch (err) {
      toast.error(`Revolut sync failed: ${String(err)}`);
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
      toast.error(`Gmail sync failed: ${String(err)}`);
    } finally {
      setSyncingGmail(false);
    }
  };

  // ── Refresh all ───────────────────────────────────────────────────────
  const handleRefreshAll = async () => {
    await Promise.all([handleStripeSync(), handleRevolutSync(), handleGmailSync()]);
  };

  // ── CSV export ─────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = filteredTxs.map(t => ({
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
    <div className="flex w-full shrink-0 flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-4">
        <PageActions>
          <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={syncing || syncingGmail || syncingRevolut}>
            <RefreshCw className={cn("h-4 w-4 mr-2", (syncing || syncingGmail || syncingRevolut) && "animate-spin")} />
            {(syncing || syncingGmail || syncingRevolut) ? "Syncing…" : "Refresh all"}
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

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Finance & Tax</h1>
            <p className="text-muted-foreground mt-1">
              Reconcile income, expenses and VAT for your Irish tax return
            </p>
          </div>
          {/* The filter stays on the page: it changes what you are looking at
              rather than doing something, and reads as part of the report. */}
          <YearFilter
            years={availableYears}
            selected={selectedYears}
            onChange={setSelectedYears}
          />
        </div>

        {/* Data Sources status bar */}
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
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
      <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

      {/* Revenue / Expenses bar chart */}
      <Card className="shrink-0">
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
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="transactions">
        <TabsList className="shrink-0 self-start">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="vat">VAT Report</TabsTrigger>
        </TabsList>

        {/* ── Transactions tab ──────────────────────────────────────────── */}
        <TabsContent value="transactions" className="mt-4 space-y-4">
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

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
                <SelectItem value="fee">Fee</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="revolut">Revolut</SelectItem>
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

            <div className="flex items-center gap-1.5 ml-auto">
              <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupBy)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Group by…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No grouping</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {filteredTxs.length} row{filteredTxs.length !== 1 ? "s" : ""}
            </span>
          </div>

          <Card className="overflow-hidden">
            <div className="max-h-[70vh] min-h-[280px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead field="date"     label="Date"     sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortHead field="customer" label="Supplier" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <TableHead>Subject</TableHead>
                    <SortHead field="category" label="Accounting Category" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <TableHead>Tax Rate</TableHead>
                    <SortHead field="amount" label="Invoice Amount" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
                    <TableHead className="text-right whitespace-nowrap">Invoices Paid</TableHead>
                    <TableHead className="text-right whitespace-nowrap">VAT Paid</TableHead>
                    <TableHead className="text-right whitespace-nowrap">VAT – Curr conv</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right whitespace-nowrap">VAT Collected</TableHead>
                    <SortHead field="type"     label="Type"     sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <TableHead>Source</TableHead>
                    <TableHead>Filename</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Drive link</TableHead>
                    <TableHead>Gmail link</TableHead>
                    <TableHead>Mailbox</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={COLUMN_COUNT} className="h-48 text-muted-foreground">
                        <div className="sticky left-0 w-[min(100vw,60rem)] text-center">Loading…</div>
                      </TableCell>
                    </TableRow>
                  ) : filteredTxs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={COLUMN_COUNT} className="h-48 text-muted-foreground">
                        <div className="sticky left-0 w-[min(100vw,60rem)] text-center">
                          No transactions found. Sync Stripe, import a statement, or add one manually.
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : groupedRows ? (
                    // ── Grouped view ──────────────────────────────────────
                    groupedRows.map(([groupKey, groupTxs]) => {
                      const groupTotal = groupTxs.reduce((s, t) => {
                        const amt = t.amount_eur_cents ?? t.amount_cents;
                        return s + (t.type === "expense" || t.type === "fee" ? -amt : amt);
                      }, 0);
                      return (
                        <>
                          <TableRow key={`g-${groupKey}`} className="bg-muted/60 hover:bg-muted/70">
                            <TableCell colSpan={5} className="py-2 font-semibold text-sm">
                              {groupBy === "month"
                                ? new Date(groupKey + "-01").toLocaleString("en-IE", { month: "long", year: "numeric" })
                                : groupKey}
                              <span className="ml-2 text-muted-foreground font-normal text-xs">
                                ({groupTxs.length} transaction{groupTxs.length !== 1 ? "s" : ""})
                              </span>
                            </TableCell>
                            <TableCell className={cn("text-right font-bold text-sm py-2", groupTotal >= 0 ? "text-emerald-700" : "text-rose-700")}>
                              {groupTotal >= 0 ? "" : "-"}{centsToEur(Math.abs(groupTotal))}
                            </TableCell>
                            <TableCell colSpan={COLUMN_COUNT - 6} />
                          </TableRow>
                          {groupTxs.map(tx => <TxRow key={tx.id} tx={tx} updateTx={updateTx} deleteTx={deleteTx} taxRates={taxRates} />)}
                        </>
                      );
                    })
                  ) : (
                    // ── Flat view ─────────────────────────────────────────
                    filteredTxs.map(tx => <TxRow key={tx.id} tx={tx} updateTx={updateTx} deleteTx={deleteTx} taxRates={taxRates} />)
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ── VAT Report tab ─────────────────────────────────────────────── */}
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
    </div>
  );
}
