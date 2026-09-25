import { useState } from "react";
import { CheckCircle2, CircleDashed, Tag, Percent, ArrowLeftRight, Trash2, X, Loader2, FileSearch } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FinanceTransaction, FinanceTaxRate,
  useBulkUpdateTransactions, useBulkDeleteTransactions,
} from "@/components/finance/useFinanceTransactions";
import { ACCOUNTING_CATEGORIES, centsToEur } from "@/components/finance/financeUtils";

const TYPES: { value: FinanceTransaction["type"]; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "refund", label: "Refund" },
  { value: "fee", label: "Fee" },
  { value: "transfer", label: "Transfer (own accounts)" },
];

interface Props {
  selected: FinanceTransaction[];
  taxRates: FinanceTaxRate[];
  onClear: () => void;
}

/**
 * Acts on every ticked row in the ledger at once: post them to a category,
 * give them a tax rate or a type, sign them off, or delete them.
 *
 * Each action is one UPDATE (or DELETE) ... WHERE id IN (...), so a batch
 * either lands whole or fails whole — never half a selection re-categorised.
 */
export function FinanceBulkActionBar({ selected, taxRates, onClear }: Props) {
  const bulkUpdate = useBulkUpdateTransactions();
  const bulkDelete = useBulkDeleteTransactions();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [finding, setFinding] = useState(false);
  const qc = useQueryClient();

  if (selected.length === 0) return null;

  const ids = selected.map(t => t.id);
  const n = selected.length;
  const rows = `${n} transaction${n === 1 ? "" : "s"}`;
  const total = selected.reduce((s, t) => s + (t.amount_eur_cents ?? t.amount_cents), 0);
  const busy = bulkUpdate.isPending || bulkDelete.isPending || finding;
  // Rows from a live feed come back on the next sync if deleted; say so.
  const fromFeed = selected.filter(t => ["revolut", "stripe", "gmail"].includes(t.source)).length;

  const apply = (updates: Partial<FinanceTransaction>, what: string) =>
    bulkUpdate.mutate({ ids, updates }, {
      onSuccess: () => { toast.success(`${what} — ${rows}`); onClear(); },
      onError: err => toast.error(`Could not update ${rows}`, {
        description: err instanceof Error ? err.message : String(err),
      }),
    });

  /**
   * Searches Gmail for the receipt behind each ticked line and attaches the
   * best match to that line (find-receipts). Only for these rows — never a
   * sweep of the mailbox.
   */
  const findReceipts = async () => {
    if (n > 50) { toast.warning("Select at most 50 lines at a time."); return; }
    setFinding(true);
    try {
      const { data, error } = await supabase.functions.invoke("find-receipts", { body: { ids } });
      if (error) throw error;
      const results = (data?.results ?? []) as { status: string }[];
      const matched = results.filter(r => r.status === "matched").length;
      const already = results.filter(r => r.status === "already_has_receipt").length;
      const none = results.filter(r => r.status === "no_match").length;
      toast.success(`Receipts: ${matched} found${already ? `, ${already} already had one` : ""}${none ? `, ${none} not found` : ""}`, {
        description: data?.timed_out
          ? "Stopped at the time limit — run it again on the rest."
          : matched ? "Attached in the Filename and Gmail columns." : undefined,
        duration: 8000,
      });
      qc.invalidateQueries({ queryKey: ["finance_transactions"] });
    } catch (err) {
      toast.error("Could not search for receipts", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setFinding(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-2">
      <span className="mr-1 text-sm font-medium">
        {rows} selected <span className="font-normal text-muted-foreground">· {centsToEur(total)}</span>
      </span>

      <Button variant="outline" size="sm" disabled={busy} onClick={findReceipts}>
        {finding ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSearch className="mr-1 h-4 w-4" />}
        Find receipts
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            <Tag className="mr-1 h-4 w-4" /> Category
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[60vh] overflow-y-auto">
          {ACCOUNTING_CATEGORIES.map(g => (
            <DropdownMenuSub key={g.group}>
              <DropdownMenuSubTrigger>{g.group}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-[60vh] overflow-y-auto">
                {g.options.map(o => (
                  <DropdownMenuItem key={o.value}
                    onSelect={() => apply({ accounting_category: o.value }, `Posted to ${o.label}`)}>
                    {o.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => apply({ accounting_category: null }, "Category cleared")}>
            Clear category (Unposted)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            <Percent className="mr-1 h-4 w-4" /> Tax rate
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Set tax rate</DropdownMenuLabel>
          {taxRates.filter(r => r.is_active).map(r => (
            <DropdownMenuItem key={r.id ?? r.name}
              // Name and percentage together, as the single-cell editor does,
              // so a later change to the rate cannot restate these rows.
              onSelect={() => apply(
                { tax_rate_name: r.name, tax_rate_percent: Number(r.percent) },
                `Tax rate ${r.name}`,
              )}>
              {r.name} ({Number(r.percent)}%)
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => apply({ tax_rate_name: null, tax_rate_percent: null }, "Tax rate cleared")}>
            No rate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            <ArrowLeftRight className="mr-1 h-4 w-4" /> Type
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {TYPES.map(t => (
            <DropdownMenuItem key={t.value} onSelect={() => apply({ type: t.value }, `Marked as ${t.label}`)}>
              {t.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" size="sm" disabled={busy}
        onClick={() => apply({ is_reconciled: true }, "Signed off")}>
        <CheckCircle2 className="mr-1 h-4 w-4" /> Sign off
      </Button>
      <Button variant="outline" size="sm" disabled={busy}
        onClick={() => apply({ is_reconciled: false }, "Sign-off removed")}>
        <CircleDashed className="mr-1 h-4 w-4" /> Un-sign
      </Button>

      <Button variant="destructive" size="sm" disabled={busy} onClick={() => setConfirmDelete(true)}>
        {bulkDelete.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
        Delete
      </Button>

      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear} disabled={busy}>
        <X className="mr-1 h-4 w-4" /> Clear selection
      </Button>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {rows}?</AlertDialogTitle>
            <AlertDialogDescription>
              {centsToEur(total)} in total. This cannot be undone.
              {fromFeed > 0 && ` ${fromFeed} of them came from a live feed (Revolut, Stripe or Gmail) and will come back on its next sync.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDelete.mutate(ids, {
                onSuccess: () => { toast.success(`Deleted ${rows}`); onClear(); },
                onError: err => toast.error(`Could not delete ${rows}`, {
                  description: err instanceof Error ? err.message : String(err),
                }),
              })}
            >
              Delete {rows}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
