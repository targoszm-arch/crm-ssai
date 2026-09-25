import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

export interface FinanceTransaction {
  id: string;
  // Widened by 20260916120000: the Gmail receipt sync writes 'gmail' and the
  // spreadsheet backfill writes 'receipt_log'.
  source: "stripe" | "revolut" | "n26" | "paypal" | "manual" | "gmail" | "receipt_log";
  source_id: string | null;
  // 'transfer' added 17 Sep 2026. Money moving between Magda's own Revolut
  // pockets is neither income nor expense; 179 such rows carrying EUR 38,846
  // were booked as one or the other and inflated both sides of the P&L.
  type: "income" | "expense" | "refund" | "fee" | "transfer";
  category: string | null;
  amount_cents: number;
  currency: string;
  amount_eur_cents: number | null;
  stripe_fee_cents: number;
  net_cents: number | null;
  transaction_date: string;
  description: string | null;
  counterparty_name: string | null;
  counterparty_email: string | null;
  counterparty_country: string | null;
  counterparty_vat_number: string | null;
  vat_treatment: string | null;
  vat_amount_cents: number;
  is_reconciled: boolean;
  notes: string | null;
  // Json, not Record<string, unknown>: this column round-trips through
  // PostgREST, and a Record is not assignable to the generated Json union —
  // which is what made every insert and update of a transaction fail to
  // typecheck.
  raw_data: Json | null;
  created_at: string;

  // Receipt-log columns. `subject` is the receipt email's subject and is what
  // identifies a document to a human; `description` mirrors it for rows that
  // came from elsewhere. The three links are how a row gets reconciled —
  // reconciliation means opening the PDF, not ticking a box.
  subject: string | null;
  vat_eur_cents: number;
  vat_collected_cents: number;
  receipt_filename: string | null;
  receipt_size: string | null;
  drive_url: string | null;
  gmail_url: string | null;
  mailbox: string | null;

  // Accounting posting. `accounting_category` is a fixed chart-of-accounts
  // code; the tax rate stores both name and the percentage it was posted at,
  // so editing a rate later cannot restate a filed period.
  accounting_category: string | null;
  tax_rate_name: string | null;
  tax_rate_percent: number | null;
}

export interface FinanceTaxRate {
  id: string;
  name: string;
  percent: number;
  applies_to: "sales" | "purchases" | "both";
  is_active: boolean;
  sort_order: number;
}

export function useFinanceTransactions(filters?: {
  type?: string;
  source?: string;
}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance_transactions", filters, user?.id],
    queryFn: async () => {
      // No date constraint: the page filters years in memory so that changing
      // the selection is instant rather than a round trip, and so that a row
      // outside the current selection can still be counted and offered.
      let q = supabase
        .from("finance_transactions")
        .select("*")
        .order("transaction_date", { ascending: false });

      if (filters?.type && filters.type !== "all") q = q.eq("type", filters.type);
      if (filters?.source && filters.source !== "all") q = q.eq("source", filters.source);

      const { data, error } = await q;
      if (error) throw error;
      return data as FinanceTransaction[];
    },
    enabled: !!user,
  });
}

/**
 * What an insert actually has to supply.
 *
 * `Omit<FinanceTransaction, "id" | "created_at" | "is_reconciled">` required
 * every other column, including the twenty-odd nullable ones — so the only
 * caller that inserts a transaction by hand could not typecheck without
 * naming fields it has no value for. The DB requires exactly these five
 * (user_id is added below); everything else is nullable.
 */
export type NewFinanceTransaction =
  Pick<FinanceTransaction, "source" | "type" | "amount_cents" | "transaction_date"> &
  Partial<Omit<FinanceTransaction, "id" | "created_at" | "is_reconciled">>;

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: NewFinanceTransaction) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("finance_transactions")
        .insert({ ...tx, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance_transactions"] }),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FinanceTransaction> & { id: string }) => {
      const { error } = await supabase
        .from("finance_transactions")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance_transactions"] }),
  });
}

export interface LastSyncedRow {
  source: string;
  last_sync: string | null;
}

export function useLastSynced() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance_last_synced", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_transactions")
        .select("source, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Group by source and find max created_at per source
      const map: Record<string, string> = {};
      for (const row of (data ?? [])) {
        if (!map[row.source] || row.created_at > map[row.source]) {
          map[row.source] = row.created_at;
        }
      }
      return map as Record<string, string>;
    },
    enabled: !!user,
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance_transactions"] }),
  });
}

/** One write for many rows: the same fields set on every selected id. */
export function useBulkUpdateTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<FinanceTransaction> }) => {
      const { error } = await supabase.from("finance_transactions").update(updates).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance_transactions"] }),
  });
}

export function useBulkDeleteTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("finance_transactions").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance_transactions"] }),
  });
}

export function useUnreconciledGmailCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance_gmail_unreconciled_count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("finance_transactions")
        .select("*", { count: "exact", head: true })
        .eq("source", "gmail")
        .eq("is_reconciled", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });
}

export function useUnreconciledGmailTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance_gmail_unreconciled", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_transactions")
        .select("*")
        .eq("source", "gmail")
        .eq("is_reconciled", false)
        .order("transaction_date", { ascending: true });
      if (error) throw error;
      return data as FinanceTransaction[];
    },
    enabled: !!user,
  });
}

/**
 * Tax rates are rows, not a constant, because the percentage is editable
 * while the names are not. A transaction stores the percentage it was posted
 * at, so changing a rate here never silently restates an already-filed VAT3.
 */
export function useTaxRates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance_tax_rates", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_tax_rates")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FinanceTaxRate[];
    },
    enabled: !!user,
  });
}

export function useUpdateTaxRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, percent }: { id: string; percent: number }) => {
      const { error } = await supabase
        .from("finance_tax_rates")
        .update({ percent })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance_tax_rates"] });
      qc.invalidateQueries({ queryKey: ["finance_transactions"] });
    },
  });
}

/**
 * Row counts per calendar year, ignoring the year filter.
 *
 * The page filters to one year, so importing a statement that predates it
 * looks exactly like an import that silently failed: hundreds of rows land
 * and the table stays empty. This is what lets the page say where they went.
 */
export function useTransactionYears() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance_transaction_years", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_transactions")
        .select("transaction_date");
      if (error) throw error;
      const counts = new Map<number, number>();
      for (const row of data ?? []) {
        const year = Number(String(row.transaction_date).slice(0, 4));
        if (!Number.isNaN(year)) counts.set(year, (counts.get(year) ?? 0) + 1);
      }
      return counts;
    },
    enabled: !!user,
  });
}

export interface FinanceVatReturn {
  id: string;
  period_start: string;
  period_end: string;
  status: "open" | "submitted";
  submitted_on: string | null;
  filed_output_vat_cents: number | null;
  filed_input_vat_cents: number | null;
  filed_net_cents: number | null;
  notes: string | null;
}

export function useVatReturns() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance_vat_returns", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_vat_returns")
        .select("*")
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data as unknown as FinanceVatReturn[];
    },
    enabled: !!user,
  });
}

/**
 * Marks a period filed, or reopens it.
 *
 * Filing copies the figures in rather than referencing them: what went to
 * Revenue is a historical fact, and classifying an old receipt next month must
 * not restate a return that has already been submitted.
 */
export function useSetVatReturnStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      period_start: string;
      period_end: string;
      status: "open" | "submitted";
      submitted_on?: string | null;
      outputVatCents?: number;
      inputVatCents?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const filed = args.status === "submitted";
      const { error } = await supabase
        .from("finance_vat_returns")
        .upsert({
          user_id: user!.id,
          period_start: args.period_start,
          period_end: args.period_end,
          status: args.status,
          submitted_on: filed ? (args.submitted_on ?? new Date().toISOString().slice(0, 10)) : null,
          filed_output_vat_cents: filed ? (args.outputVatCents ?? 0) : null,
          filed_input_vat_cents: filed ? (args.inputVatCents ?? 0) : null,
          filed_net_cents: filed ? (args.outputVatCents ?? 0) - (args.inputVatCents ?? 0) : null,
        } as never, { onConflict: "user_id,period_start,period_end" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance_vat_returns"] }),
  });
}
