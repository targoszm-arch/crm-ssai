import { FinanceTransaction } from "@/components/finance/useFinanceTransactions";

/**
 * Supplier rules: what is already known about a counterparty.
 *
 * 726 bank rows carry no VAT treatment and no category, and they are the same
 * few dozen suppliers repeating: Anthropic 31 times across three spellings,
 * Framer 17 across three, Lovable 35, Supabase 16. The accountant re-decides
 * each one every month.
 *
 * A rule states a fact about a supplier ("Anthropic Ireland charges Irish
 * VAT"), and applying it fills only the fields still empty. It cannot
 * overwrite a human decision — the same guarantee `ignoreDuplicates` gives the
 * syncs, for the same reason: a person who classified a row knew something the
 * rule does not.
 */

export interface SupplierRule {
  id: string;
  match_pattern: string;
  label: string | null;
  counterparty_country: string | null;
  counterparty_vat_number: string | null;
  vat_treatment: string | null;
  accounting_category: string | null;
  priority: number;
  is_active: boolean;
  notes: string | null;
}

/** The fields a rule can set. Everything else on a transaction is untouchable. */
export const RULE_FIELDS = [
  "counterparty_country",
  "counterparty_vat_number",
  "vat_treatment",
  "accounting_category",
] as const;

export type RuleField = (typeof RULE_FIELDS)[number];

/**
 * The text a rule matches against.
 *
 * Both name and description, because the bank populates them inconsistently:
 * 153 rows had no counterparty at all until their leg description was
 * restored, and card descriptors mangle names in ways no single field
 * captures ("google ads9621203723", "dnhgodaddy  *#83105425").
 */
export function matchableText(tx: Pick<FinanceTransaction, "counterparty_name" | "description" | "subject">): string {
  return [tx.counterparty_name, tx.description, tx.subject]
    .filter(Boolean).join(" ").toLowerCase();
}

/**
 * The rule that wins for a transaction, or null.
 *
 * Lowest priority number first, so a specific rule beats a general one. This
 * is not decoration: "anthropic ireland, limited" charges Irish VAT and
 * "anthropic, pbc" does not, and both contain the string "anthropic". Get the
 * order wrong and US spend lands in T2 as reclaimable Irish input VAT.
 */
export function ruleFor(
  tx: Pick<FinanceTransaction, "counterparty_name" | "description" | "subject">,
  rules: SupplierRule[],
): SupplierRule | null {
  const text = matchableText(tx);
  if (!text) return null;
  const hits = rules
    .filter(r => r.is_active && text.includes(r.match_pattern.trim().toLowerCase()))
    // Priority first; a longer pattern breaks a tie, since the more specific
    // string is the more specific claim.
    .sort((a, b) => a.priority - b.priority || b.match_pattern.length - a.match_pattern.length);
  return hits[0] ?? null;
}

export interface RuleProposal {
  tx: FinanceTransaction;
  rule: SupplierRule;
  /** Only the fields this would actually fill. Empty means nothing to do. */
  patch: Partial<Record<RuleField, string>>;
}

/**
 * What applying the rules would change, and nothing more.
 *
 * A field is proposed only when the rule asserts a value AND the transaction
 * has none. That single condition is what makes this safe to run repeatedly:
 * the second run proposes nothing, and a row someone corrected by hand is
 * never reverted.
 */
export function proposeFromRules(
  txs: FinanceTransaction[],
  rules: SupplierRule[],
): RuleProposal[] {
  const out: RuleProposal[] = [];
  for (const tx of txs) {
    const rule = ruleFor(tx, rules);
    if (!rule) continue;

    const patch: Partial<Record<RuleField, string>> = {};
    for (const f of RULE_FIELDS) {
      const asserted = rule[f];
      const current = tx[f as keyof FinanceTransaction];
      // Null and undefined only — NOT empty string. The write filters
      // `.is(field, null)`, so proposing for an empty string produced an
      // update that matched zero rows, was counted as applied, and came back
      // on the next run. The proposal has to ask the same question the write
      // asks or the two disagree forever.
      if (asserted && (current === null || current === undefined)) {
        patch[f] = asserted;
      }
    }
    if (Object.keys(patch).length) out.push({ tx, rule, patch });
  }
  return out;
}

/** Rows no rule covers — where the next rule should be written. */
export function unmatchedSuppliers(
  txs: FinanceTransaction[],
  rules: SupplierRule[],
): { name: string; count: number; eurCents: number }[] {
  const by = new Map<string, { name: string; count: number; eurCents: number }>();
  for (const tx of txs) {
    if (ruleFor(tx, rules)) continue;
    const name = (tx.counterparty_name ?? tx.description ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const row = by.get(key) ?? { name, count: 0, eurCents: 0 };
    row.count += 1;
    row.eurCents += Math.abs(tx.amount_eur_cents ?? tx.amount_cents);
    by.set(key, row);
  }
  // Biggest spend first: that is where a rule buys the most.
  return [...by.values()].sort((a, b) => b.eurCents - a.eurCents);
}
