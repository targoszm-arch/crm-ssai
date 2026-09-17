import { useCallback, useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type ValueFormatterParams,
} from "ag-grid-community";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FinanceTransaction, FinanceTaxRate,
  useUpdateTransaction, useDeleteTransaction,
} from "@/components/finance/useFinanceTransactions";
import {
  centsToEur, ACCOUNTING_CATEGORIES, ACCOUNTING_CATEGORY_LABELS,
} from "@/components/finance/financeUtils";
import { financeGridTheme, financeGridThemeDark } from "@/components/finance/gridTheme";

/**
 * The transactions ledger, on a real data grid.
 *
 * What this replaces and why, since "we swapped the table library" is not a
 * reason on its own:
 *
 *   * **Nothing was virtualized.** 1,018 rows x ~80 components each — twenty
 *     cells plus two Radix Selects, two Tooltips and an AlertDialog per row —
 *     put something like 80,000 components in the tree at once. React rendered
 *     it slowly and React DevTools could not walk it at all. AG Grid renders
 *     only the rows in view, so the count stops scaling with the data.
 *
 *   * **Columns were aligned by hand.** Widths were guessed per cell and the
 *     header was a separate element, so the two drifted. A grid owns both.
 *
 *   * Sorting, resizing, reordering, pinning and keyboard navigation were
 *     either hand-written or missing. They come with the grid.
 *
 * Community edition (MIT) on purpose. Row grouping, set filters and Excel
 * export are Enterprise; only grouping is a feature this page had, and it is
 * kept in the page's own toolbar rather than silently dropped.
 */
ModuleRegistry.registerModules([AllCommunityModule]);

/** Reads the `dark` class off <html>, and keeps reading it. */
function useIsDark(): boolean {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const CATEGORY_VALUES = ["", ...ACCOUNTING_CATEGORIES.flatMap(g => g.options.map(o => o.value))];

/** Cents -> euro, with an em dash for "nothing here" rather than EUR 0.00. */
const money = (p: ValueFormatterParams) =>
  p.value == null || p.value === 0 ? "—" : centsToEur(p.value as number);

interface Props {
  rows: FinanceTransaction[];
  taxRates: FinanceTaxRate[];
  /** Quick-filter text from the page toolbar. */
  search: string;
  /** Hands the grid's API up so the page can count and export what is
   *  actually displayed, rather than filtering a second time itself. */
  onGridReady?: (api: GridApi<FinanceTransaction>) => void;
  /** Fires whenever the displayed row count could have changed. */
  onDisplayedRowsChanged?: (count: number) => void;
}

export function FinanceGrid({ rows, taxRates, search, onGridReady, onDisplayedRowsChanged }: Props) {
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();
  const isDark = useIsDark();
  const [pendingDelete, setPendingDelete] = useState<FinanceTransaction | null>(null);

  const taxRateNames = useMemo(
    () => ["", ...taxRates.filter(r => r.is_active).map(r => r.name)],
    [taxRates],
  );

  /**
   * The editable columns write straight through to Postgres.
   *
   * The grid repaints optimistically the moment the editor closes, long before
   * the request comes back, so a rejected write left the new value on screen
   * with nothing stored behind it. Worse for the tax rate, which writes two
   * fields: a failure could leave a rate NAME visible next to a percentage
   * that was never saved, which is a number someone files a return on.
   *
   * Every edit therefore restores `oldValue` in `onError` and says so.
   */
  const onCellValueChanged = useCallback((e: CellValueChangedEvent<FinanceTransaction>) => {
    const tx = e.data;
    if (!tx) return;
    const field = e.colDef.field;
    const node = e.node;

    const revert = (label: string) => (err: unknown) => {
      // setDataValue rather than refreshCells: it puts the old value back in
      // the row data the grid is reading from, so a later repaint cannot
      // resurrect the rejected one.
      node?.setDataValue(field!, e.oldValue);
      toast.error(`Could not save ${label}`, {
        description: err instanceof Error ? err.message : String(err),
      });
    };

    if (field === "accounting_category") {
      updateTx.mutate(
        { id: tx.id, accounting_category: e.newValue || null },
        { onError: revert("the accounting category") },
      );
      return;
    }
    if (field === "tax_rate_name") {
      // Store the percentage as it stands today alongside the name, so editing
      // a rate later cannot restate a period that has already been filed.
      const rate = taxRates.find(r => r.name === e.newValue);
      const oldPercent = tx.tax_rate_percent;
      updateTx.mutate(
        {
          id: tx.id,
          tax_rate_name: e.newValue || null,
          tax_rate_percent: rate ? Number(rate.percent) : null,
        },
        {
          onError: (err) => {
            // Both fields go back, not just the one that was edited.
            node?.setDataValue("tax_rate_percent", oldPercent);
            revert("the tax rate")(err);
          },
        },
      );
    }
  }, [updateTx, taxRates]);

  /** Sign-off. Available on every row, not only the ones a dialog covers. */
  const toggleReconciled = useCallback(
    (tx: FinanceTransaction, next: boolean) => {
      updateTx.mutate(
        { id: tx.id, is_reconciled: next },
        {
          onError: (err) =>
            toast.error("Could not change the reconciled flag", {
              description: err instanceof Error ? err.message : String(err),
            }),
        },
      );
    },
    [updateTx],
  );

  const columnDefs = useMemo<ColDef<FinanceTransaction>[]>(() => [
    {
      field: "transaction_date", headerName: "Date", width: 112, pinned: "left",
      sort: "desc",
      valueFormatter: p => p.value ? format(new Date(p.value as string), "dd MMM yy") : "",
    },
    {
      field: "counterparty_name", headerName: "Supplier", width: 190, pinned: "left",
      // Falls back to description: 153 Revolut rows carried no counterparty
      // until their leg description was restored, and some still do not.
      valueGetter: p => p.data?.counterparty_name ?? p.data?.description ?? "",
    },
    {
      field: "subject", headerName: "Subject", width: 260, tooltipField: "subject",
      valueGetter: p => p.data?.subject ?? p.data?.description ?? "",
    },
    {
      field: "accounting_category", headerName: "Accounting Category", width: 190,
      editable: true,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: CATEGORY_VALUES },
      valueFormatter: p =>
        p.value ? (ACCOUNTING_CATEGORY_LABELS[p.value as string] ?? String(p.value)) : "Unposted",
    },
    {
      field: "tax_rate_name", headerName: "Tax Rate", width: 130,
      editable: true,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: taxRateNames },
      valueFormatter: p => (p.value ? String(p.value) : "No rate"),
    },
    {
      field: "amount_cents", headerName: "Invoice Amount", width: 140,
      type: "rightAligned", valueFormatter: money,
      // Expenses read negative here even though the column stores magnitude —
      // the sign lives in `type`, and a ledger that shows spending as positive
      // reads wrong at a glance.
      valueGetter: p => {
        const v = p.data?.amount_cents ?? 0;
        return p.data?.type === "expense" || p.data?.type === "fee" ? -v : v;
      },
      // Transfers between pockets are excluded from the P&L, so colouring one
      // green reads as income the business never earned. Neutral for those.
      cellClass: p => {
        if (p.data?.type === "transfer") return "text-muted-foreground";
        return typeof p.value === "number" && p.value < 0
          ? "text-rose-600" : "text-emerald-600";
      },
    },
    { field: "amount_eur_cents", headerName: "Invoices Paid", width: 130, type: "rightAligned", valueFormatter: money },
    { field: "vat_amount_cents", headerName: "VAT Paid", width: 110, type: "rightAligned", valueFormatter: money },
    { field: "vat_eur_cents", headerName: "VAT – Curr conv", width: 140, type: "rightAligned", valueFormatter: money },
    { field: "currency", headerName: "Currency", width: 95 },
    { field: "vat_collected_cents", headerName: "VAT Collected", width: 130, type: "rightAligned", valueFormatter: money },
    { field: "type", headerName: "Type", width: 100 },
    { field: "source", headerName: "Source", width: 110 },
    { field: "receipt_filename", headerName: "Filename", width: 180 },
    { field: "receipt_size", headerName: "Size", width: 90 },
    {
      field: "drive_url", headerName: "Drive", width: 80,
      cellRenderer: (p: ICellRendererParams<FinanceTransaction>) =>
        p.value
          ? <a href={p.value as string} target="_blank" rel="noopener noreferrer"
               className="text-primary hover:underline">Open</a>
          : "—",
    },
    {
      field: "gmail_url", headerName: "Gmail", width: 80,
      cellRenderer: (p: ICellRendererParams<FinanceTransaction>) =>
        p.value
          ? <a href={p.value as string} target="_blank" rel="noopener noreferrer"
               className="text-primary hover:underline">Open</a>
          : "—",
    },
    { field: "mailbox", headerName: "Mailbox", width: 150 },
    { field: "notes", headerName: "Notes", width: 200 },
    {
      field: "is_reconciled", headerName: "Signed off", width: 105, pinned: "right",
      // The old table had a "mark reconciled" action and the grid dropped it,
      // which left every non-Gmail row with no way to be signed off at all —
      // the receipt review dialog only ever covered source = 'gmail'.
      cellRenderer: (p: ICellRendererParams<FinanceTransaction>) => (
        <div className="flex h-full items-center justify-center">
          <Checkbox
            checked={p.value === true}
            onCheckedChange={c => p.data && toggleReconciled(p.data, c === true)}
            aria-label="Reconciled"
          />
        </div>
      ),
    },
    {
      headerName: "", width: 60, pinned: "right",
      sortable: false, filter: false, resizable: false,
      cellRenderer: (p: ICellRendererParams<FinanceTransaction>) => (
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => p.data && setPendingDelete(p.data)}
          aria-label="Delete transaction"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ], [taxRateNames, toggleReconciled]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    resizable: true,
    filter: true,
    // Off by default: twenty columns of floating filters is a wall of inputs,
    // and the page toolbar already carries the filters people actually use.
    floatingFilter: false,
    suppressHeaderMenuButton: false,
  }), []);

  return (
    <div className="h-full w-full">
      <AgGridReact<FinanceTransaction>
        theme={isDark ? financeGridThemeDark : financeGridTheme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        // Identity by row id, so an edit or a refetch repaints the row that
        // changed instead of rebuilding the body.
        getRowId={p => p.data.id}
        quickFilterText={search}
        onCellValueChanged={onCellValueChanged}
        onGridReady={(e: GridReadyEvent<FinanceTransaction>) => {
          onGridReady?.(e.api);
          onDisplayedRowsChanged?.(e.api.getDisplayedRowCount());
        }}
        // The page used to count its own filtered array while the grid applied
        // a quick filter across every column on top of it, so the toolbar count
        // and the visible rows disagreed. The grid is the only filter now, and
        // it reports what it is showing.
        onModelUpdated={e => onDisplayedRowsChanged?.(e.api.getDisplayedRowCount())}
        animateRows={false}
        suppressCellFocus={false}
        stopEditingWhenCellsLoseFocus
        rowHeight={40}
        headerHeight={38}
        overlayNoRowsTemplate="No transactions match these filters."
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={v => { if (!v) setPendingDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.transaction_date} ·{" "}
              {pendingDelete?.counterparty_name ?? pendingDelete?.description ?? "—"} ·{" "}
              {centsToEur(pendingDelete?.amount_eur_cents ?? pendingDelete?.amount_cents ?? 0)}.
              This cannot be undone, and if the row came from a sync it will
              reappear on the next run.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteTx.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
