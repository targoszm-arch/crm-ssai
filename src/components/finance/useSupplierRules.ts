import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SupplierRule, RuleProposal } from "@/components/finance/supplierRules";
import { MatchCandidate } from "@/components/finance/matchUtils";
import { toast } from "sonner";

export function useSupplierRules() {
  return useQuery<SupplierRule[]>({
    queryKey: ["finance_supplier_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_supplier_rules")
        .select("*")
        .order("priority")
        .order("match_pattern");
      if (error) throw error;
      return (data ?? []) as SupplierRule[];
    },
  });
}

/** Pairs already decided, so a rerun does not re-offer them. */
export function useReceiptMatches() {
  return useQuery({
    queryKey: ["finance_receipt_matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_receipt_matches")
        .select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useApplyRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (proposals: RuleProposal[]) => {
      let applied = 0;
      for (const p of proposals) {
        // The filters repeat what proposeFromRules already checked. That is
        // deliberate: the proposal was computed against a snapshot, and
        // between then and now a sync or another tab may have classified the
        // row. A rule must never win over that.
        let q = supabase
          .from("finance_transactions")
          .update({ ...p.patch, classified_by_rule_id: p.rule.id })
          .eq("id", p.tx.id);
        for (const field of Object.keys(p.patch)) q = q.is(field, null);

        const { error } = await q;
        if (error) throw error;
        applied++;
      }
      return applied;
    },
    onSuccess: (n) => {
      toast.success(`${n} transaction${n === 1 ? "" : "s"} classified`);
      qc.invalidateQueries({ queryKey: ["finance_transactions"] });
    },
    onError: (e) => toast.error(`Could not apply rules: ${String(e)}`),
  });
}

export function useSaveMatches() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (
      decisions: { candidate: MatchCandidate; status: "confirmed" | "rejected" }[],
    ) => {
      if (!user) throw new Error("not signed in");
      const rows = decisions.map(d => ({
        user_id: user.id,
        bank_transaction_id: d.candidate.bank.id,
        receipt_transaction_id: d.candidate.receipt.id,
        status: d.status,
        score: d.candidate.score,
        reasons: d.candidate.reasons,
        decided_at: new Date().toISOString(),
      }));
      // onConflict on the pair: deciding the same pair twice updates the
      // decision rather than failing or duplicating it.
      const { error } = await supabase
        .from("finance_receipt_matches")
        .upsert(rows, { onConflict: "bank_transaction_id,receipt_transaction_id" });
      if (error) throw error;
      return rows.filter(r => r.status === "confirmed").length;
    },
    onSuccess: (n) => {
      toast.success(`${n} match${n === 1 ? "" : "es"} confirmed`);
      qc.invalidateQueries({ queryKey: ["finance_receipt_matches"] });
    },
    onError: (e) => toast.error(`Could not save matches: ${String(e)}`),
  });
}
