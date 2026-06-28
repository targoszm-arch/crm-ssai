import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface FinanceTransaction {
  id: string;
  source: "stripe" | "revolut" | "paypal" | "manual";
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
}

export function useFinanceTransactions(filters?: {
  year?: number;
  type?: string;
  source?: string;
}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance_transactions", filters, user?.id],
    queryFn: async () => {
      let q = supabase
        .from("finance_transactions")
        .select("*")
        .order("transaction_date", { ascending: false });

      if (filters?.year) {
        q = q
          .gte("transaction_date", `${filters.year}-01-01`)
          .lte("transaction_date", `${filters.year}-12-31`);
      }
      if (filters?.type && filters.type !== "all") {
        q = q.eq("type", filters.type);
      }
      if (filters?.source && filters.source !== "all") {
        q = q.eq("source", filters.source);
      }

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
