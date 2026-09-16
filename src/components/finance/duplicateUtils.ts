import { FinanceTransaction } from "@/components/finance/useFinanceTransactions";

/**
 * Duplicate detection.
 *
 * The bar is deliberately high. A first pass keyed only on date + amount
 * flagged 41 rows; inspecting them showed RunPod and Vercel both charging
 * EUR 17.62 on the same day, and two different PayPal receipts of EUR 0.19 —
 * distinct transactions that merely rhyme. Same day, same amount and the
 * *same counterparty* is the narrowest rule that still catches the real case:
 * one payment arriving twice, once from a receipt and once from the bank.
 *
 * Even then it proposes rather than decides. Two genuine EUR 1,000 transfers
 * on one day look identical in every recorded field, and no rule can tell
 * them from a double-import — only the person who made them can. So every
 * function here returns candidates for a human to approve or decline; none of
 * them deletes or skips anything on its own.
 */

/** The fields matching needs. Both stored rows and parsed CSV rows have them. */
export interface DupRow {
  transaction_date: string;
  type: string;
  counterparty_name: string | null;
  description: string | null;
  amount_cents: number;
  amount_eur_cents: number | null;
}

/** Identity for matching: lower-cased, punctuation removed. */
export function normaliseWho(tx: Pick<DupRow, "counterparty_name" | "description">): string {
  const raw = (tx.counterparty_name ?? "").trim() || (tx.description ?? "").trim();
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function amountOf(tx: Pick<DupRow, "amount_cents" | "amount_eur_cents">): number {
  return tx.amount_eur_cents ?? tx.amount_cents;
}

export function duplicateKey(tx: DupRow): string {
  return [tx.transaction_date, tx.type, amountOf(tx), normaliseWho(tx)].join("|");
}

/** False when the row carries too little to match on — never a duplicate. */
export function isMatchable(tx: DupRow): boolean {
  return amountOf(tx) !== 0 && normaliseWho(tx) !== "";
}

export interface DuplicateGroup {
  key: string;
  /** Oldest row, treated as the one to keep. */
  keep: FinanceTransaction;
  /** Later rows proposed for removal. */
  extras: FinanceTransaction[];
}

/** Groups of existing rows that look like the same transaction recorded twice. */
export function findDuplicateGroups(rows: FinanceTransaction[]): DuplicateGroup[] {
  const byKey = new Map<string, FinanceTransaction[]>();

  for (const row of rows) {
    if (!isMatchable(row)) continue;
    const key = duplicateKey(row);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(row);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, members] of byKey) {
    if (members.length < 2) continue;
    // Keep the earliest-created row: it is the one that has most likely been
    // classified or reconciled already.
    const sorted = [...members].sort((a, b) => a.created_at.localeCompare(b.created_at));
    groups.push({ key, keep: sorted[0], extras: sorted.slice(1) });
  }

  return groups.sort((a, b) => b.keep.transaction_date.localeCompare(a.keep.transaction_date));
}

export interface IncomingDuplicate<T extends DupRow> {
  /** Index of the flagged row in the incoming array. */
  index: number;
  row: T;
  /** Rows already stored that it matches. Empty when it clashes within the file. */
  existing: FinanceTransaction[];
  /** Index of the earlier line in the same file it repeats, if any. */
  repeatsIndex: number | null;
  /** True when a stored row already carries this exact provider id. */
  sameSourceId: boolean;
}

/**
 * Rows in a statement that look like money already recorded — either against
 * what is stored, or against an earlier line in the same file.
 *
 * A same-source_id match is called out separately: the database would refuse
 * it anyway (ON CONFLICT DO NOTHING), so it is certainly the same transaction
 * rather than a guess.
 */
export function findIncomingDuplicates<T extends DupRow & { source_id?: string | null }>(
  incoming: T[],
  existing: FinanceTransaction[],
  source?: string,
): IncomingDuplicate<T>[] {
  const byKey = new Map<string, FinanceTransaction[]>();
  const bySourceId = new Set<string>();

  for (const row of existing) {
    if (row.source_id && (!source || row.source === source)) bySourceId.add(row.source_id);
    if (!isMatchable(row)) continue;
    const key = duplicateKey(row);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(row);
  }

  const seenInFile = new Map<string, number>();
  const out: IncomingDuplicate<T>[] = [];

  incoming.forEach((row, index) => {
    if (!isMatchable(row)) return;
    const key = duplicateKey(row);
    const matches = byKey.get(key) ?? [];
    const repeatsIndex = seenInFile.has(key) ? seenInFile.get(key)! : null;
    if (!seenInFile.has(key)) seenInFile.set(key, index);

    const sameSourceId = !!row.source_id && bySourceId.has(row.source_id);
    if (matches.length === 0 && repeatsIndex === null && !sameSourceId) return;

    out.push({ index, row, existing: matches, repeatsIndex, sameSourceId });
  });

  return out;
}
