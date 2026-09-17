import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Link2, Tags } from "lucide-react";
import { FinanceTransaction } from "@/components/finance/useFinanceTransactions";
import { centsToEur } from "@/components/finance/financeUtils";
import { proposeFromRules, unmatchedSuppliers, RuleProposal } from "@/components/finance/supplierRules";
import { proposeMatches, unreceiptedSpend, CONFIDENT, MatchCandidate } from "@/components/finance/matchUtils";
import {
  useSupplierRules, useReceiptMatches, useApplyRules, useSaveMatches,
} from "@/components/finance/useSupplierRules";

/**
 * The two remaining manual passes over the ledger, each as a reviewable list.
 *
 * Both work the same way and for the same reason: a proposal with its evidence
 * shown, ticked by default only when the evidence is strong, and applied in
 * one action. Neither writes anything until the button is pressed, because
 * both are guesses about money.
 */
export function ReconcilePanel({ txs }: { txs: FinanceTransaction[] }) {
  const { data: rules = [], isLoading: rulesLoading } = useSupplierRules();
  const { data: savedMatches = [] } = useReceiptMatches();
  const applyRules = useApplyRules();
  const saveMatches = useSaveMatches();

  // ── Classification ──────────────────────────────────────────────────────
  const proposals = useMemo(() => proposeFromRules(txs, rules), [txs, rules]);
  const [skippedRules, setSkippedRules] = useState<Set<string>>(new Set());

  const uncovered = useMemo(
    () => unmatchedSuppliers(txs.filter(t => t.type === "expense" || t.type === "fee"), rules).slice(0, 12),
    [txs, rules]);

  // ── Matching ────────────────────────────────────────────────────────────
  // A CONFIRMED pair takes both its rows out of play — they are spoken for.
  //
  // A REJECTED pair must not. Rejecting "this Anthropic charge is not that
  // Anthropic receipt" says nothing about either row's real partner, and
  // blacklisting both ids meant one wrong rejection permanently hid the
  // correct pairing from ever being offered. Only the pair is dead.
  const confirmedRowIds = useMemo(() => {
    const s = new Set<string>();
    for (const m of savedMatches as { bank_transaction_id: string; receipt_transaction_id: string; status: string }[]) {
      if (m.status !== "confirmed") continue;
      s.add(m.bank_transaction_id);
      s.add(m.receipt_transaction_id);
    }
    return s;
  }, [savedMatches]);

  const rejectedPairs = useMemo(() => {
    const s = new Set<string>();
    for (const m of savedMatches as { bank_transaction_id: string; receipt_transaction_id: string; status: string }[]) {
      if (m.status === "rejected") s.add(`${m.bank_transaction_id}:${m.receipt_transaction_id}`);
    }
    return s;
  }, [savedMatches]);

  const candidates = useMemo(
    () => proposeMatches(txs, confirmedRowIds)
      .filter(c => !rejectedPairs.has(`${c.bank.id}:${c.receipt.id}`)),
    [txs, confirmedRowIds, rejectedPairs]);
  const key = (c: MatchCandidate) => `${c.bank.id}:${c.receipt.id}`;

  // Anything below CONFIDENT starts UNTICKED. Pre-ticking every candidate
  // meant "Confirm N" wrote a score of 46 — an amount within 2% and a week
  // apart, with no agreeing name — as an accepted fact about which receipt
  // documents which payment. The badge showed the score but nothing acted on
  // it. A weak pair is a question, and a question should not be pre-answered.
  //
  // Stored as overrides rather than a ticked set so the default survives the
  // list being recomputed, and so an untouched pair always reflects its score.
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const isTicked = (c: MatchCandidate) => overrides.get(key(c)) ?? c.score >= CONFIDENT;
  const setTicked = (c: MatchCandidate, v: boolean) =>
    setOverrides(m => new Map(m).set(key(c), v));

  const gap = useMemo(() => unreceiptedSpend(txs, confirmedRowIds), [txs, confirmedRowIds]);

  const toApply = proposals.filter(p => !skippedRules.has(p.tx.id));
  const toConfirm = candidates.filter(isTicked);
  const toReject = candidates.filter(c => !isTicked(c));

  if (rulesLoading) {
    return <Card className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></Card>;
  }

  return (
    <Tabs defaultValue="classify" className="space-y-4">
      <TabsList>
        <TabsTrigger value="classify" className="gap-2">
          <Tags className="h-4 w-4" /> Classification
          {proposals.length > 0 && <Badge variant="secondary">{proposals.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="match" className="gap-2">
          <Link2 className="h-4 w-4" /> Receipt matching
          {candidates.length > 0 && <Badge variant="secondary">{candidates.length}</Badge>}
        </TabsTrigger>
      </TabsList>

      {/* ── Classification ─────────────────────────────────────────────── */}
      <TabsContent value="classify" className="space-y-4">
        <Card className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm">
            <strong>{proposals.length}</strong> transaction{proposals.length === 1 ? "" : "s"} a
            supplier rule can fill in, from <strong>{rules.length}</strong> rules.
            <span className="text-muted-foreground"> Only empty fields are touched — anything
              classified by hand is left exactly as it is.</span>
          </div>
          <Button
            disabled={!toApply.length || applyRules.isPending}
            onClick={() => applyRules.mutate(toApply)}
          >
            {applyRules.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply {toApply.length}
          </Button>
        </Card>

        {proposals.length > 0 && (
          <Card className="overflow-hidden">
            <Table containerClassName="max-h-[52vh]">
              <TableHeader className="sticky top-0 z-20 bg-background [&_th]:bg-background shadow-[inset_0_-1px_0_hsl(var(--border))]">
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Would set</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((p: RuleProposal) => (
                  <TableRow key={p.tx.id}>
                    <TableCell>
                      <Checkbox
                        checked={!skippedRules.has(p.tx.id)}
                        onCheckedChange={v => setSkippedRules(s => {
                          const n = new Set(s);
                          if (v) n.delete(p.tx.id); else n.add(p.tx.id);
                          return n;
                        })}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{p.tx.transaction_date}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="text-sm truncate block">
                        {p.tx.counterparty_name ?? p.tx.description ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">
                      {centsToEur(p.tx.amount_eur_cents ?? p.tx.amount_cents)}
                    </TableCell>
                    <TableCell className="text-sm">{p.rule.label ?? p.rule.match_pattern}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {Object.entries(p.patch).map(([f, v]) => (
                          <Badge key={f} variant="outline" className="text-xs font-normal">
                            {f.replace("counterparty_", "").replace(/_/g, " ")}: {v}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {uncovered.length > 0 && (
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-1">No rule yet</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Biggest spend first — where the next rule is worth the most.
            </p>
            <div className="flex flex-wrap gap-2">
              {uncovered.map(u => (
                <Badge key={u.name} variant="secondary" className="font-normal">
                  {u.name} · {centsToEur(u.eurCents)} · {u.count}×
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </TabsContent>

      {/* ── Matching ───────────────────────────────────────────────────── */}
      <TabsContent value="match" className="space-y-4">
        <Card className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm">
            <strong>{candidates.length}</strong> bank line{candidates.length === 1 ? "" : "s"} look
            like they have a receipt.{" "}
            <span className="text-muted-foreground">
              {gap.rows.length} payment{gap.rows.length === 1 ? "" : "s"} worth{" "}
              {centsToEur(gap.eurCents)} still have none — input VAT needs a document.
            </span>
          </div>
          {/* Enabled whenever there is anything to record, not only when
              something is ticked. Gating on toConfirm meant a reviewer who
              went through the list and rejected every pair could not save that
              work, and the same wrong pairs came back next time. A rejection
              is a decision and deserves to persist. */}
          <Button
            disabled={!candidates.length || saveMatches.isPending}
            onClick={() => saveMatches.mutate([
              ...toConfirm.map(c => ({ candidate: c, status: "confirmed" as const })),
              ...toReject.map(c => ({ candidate: c, status: "rejected" as const })),
            ])}
          >
            {saveMatches.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {toConfirm.length > 0
              ? `Confirm ${toConfirm.length}${toReject.length ? `, reject ${toReject.length}` : ""}`
              : `Reject ${toReject.length}`}
          </Button>
        </Card>

        {candidates.length > 0 && (
          <Card className="overflow-hidden">
            <Table containerClassName="max-h-[52vh]">
              <TableHeader className="sticky top-0 z-20 bg-background [&_th]:bg-background shadow-[inset_0_-1px_0_hsl(var(--border))]">
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Bank line</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Why</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map(c => (
                  <TableRow key={key(c)}>
                    <TableCell>
                      <Checkbox
                        checked={isTicked(c)}
                        onCheckedChange={v => setTicked(c, v === true)}
                      />
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <span className="text-sm truncate block">
                        {c.bank.counterparty_name ?? c.bank.description ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">{c.bank.transaction_date}</span>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <span className="text-sm truncate block">
                        {c.receipt.subject ?? c.receipt.description ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.receipt.transaction_date}
                        {c.receipt.vat_eur_cents ? ` · VAT ${centsToEur(c.receipt.vat_eur_cents)}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">
                      {centsToEur(c.bank.amount_eur_cents ?? c.bank.amount_cents)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant={c.score >= CONFIDENT ? "default" : "secondary"} className="text-xs">
                          {c.score}
                        </Badge>
                        {c.reasons.map(r => (
                          <span key={r} className="text-xs text-muted-foreground">{r}</span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
