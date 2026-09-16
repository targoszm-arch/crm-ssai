import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface FinanceTransaction {
  id: string;
  // Widened by 20260916120000: the Gmail receipt sync writes 'gmail' and the
  // spreadsheet backfill writes 'receipt_log'.
  source: "stripe" | "revolut" | "paypal" | "manual" | "gmail" | "receipt_log";
  source_id: string | null;
  type: "income" | "expense" | "refund" | "fee";
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
  raw_data: Record<string, unknown> | null;
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

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: Omit<FinanceTransaction, "id" | "created_at" | "is_reconciled">) => {
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
