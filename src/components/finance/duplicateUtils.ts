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
  /** The row to keep: the one carrying the most evidence. */
  keep: FinanceTransaction;
  /** The others, proposed for removal. */
  extras: FinanceTransaction[];
}

/**
 * What a row carries that a tax return depends on.
 *
 * Keeping the oldest row was wrong. The common cross-source pair is a bare
 * bank line from a statement and, days later, the Gmail receipt for the same
 * payment — carrying the VAT, the treatment, the PDF and the Gmail link. The
 * bank line is always the older one, so "keep the oldest" deleted the
 * document and changed the VAT figure while keeping the emptier row.
 */
const EVIDENCE: { field: keyof FinanceTransaction; label: string }[] = [
  { field: "vat_treatment", label: "VAT treatment" },
  { field: "vat_eur_cents", label: "VAT amount" },
  { field: "vat_collected_cents", label: "VAT collected" },
  { field: "accounting_category", label: "accounting category" },
  { field: "drive_url", label: "Drive link" },
  { field: "gmail_url", label: "Gmail link" },
  { field: "receipt_filename", label: "receipt file" },
  { field: "counterparty_vat_number", label: "supplier VAT number" },
  { field: "notes", label: "notes" },
];

function carries(tx: FinanceTransaction, field: keyof FinanceTransaction): boolean {
  const v = tx[field];
  return v !== null && v !== undefined && v !== "" && v !== 0;
}

export function evidenceScore(tx: FinanceTransaction): number {
  let n = EVIDENCE.reduce((s, e) => s + (carries(tx, e.field) ? 1 : 0), 0);
  if (tx.is_reconciled) n += 2;   // someone has signed this row off
  return n;
}

/** Fields the candidate has and the row being kept does not. */
export function evidenceLostIfDeleted(
  candidate: FinanceTransaction,
  keep: FinanceTransaction,
): string[] {
  return EVIDENCE
    .filter(e => carries(candidate, e.field) && !carries(keep, e.field))
    .map(e => e.label);
}

/**
 * The cross-source pair the exact key cannot see.
 *
 * A receipt and the bank line that paid it agree on none of the three fields
 * `duplicateKey` joins on. The receipt is dated when the vendor issued it and
 * the bank line when the money moved, a day or two later. The receipt states
 * the invoice currency and the bank states what the account was debited, so
 * USD 49.00 and EUR 44.88 are one payment wearing two numbers. And the names
 * come from different places — "Cartesia AI, Inc." on the receipt against
 * "Cartesia" on the statement, "Anthropic, PBC" against "Anthropic".
 *
 * Measured against what is stored, the exact key found 1 of 27 such pairs.
 *
 * So these three tolerances, and no more: a few days, a name that starts the
 * same, and an amount close enough to be the same money across an FX rate.
 */
const PAIR_MAX_DAYS = 3;
const PAIR_NAME_PREFIX = 5;
const PAIR_AMOUNT_TOLERANCE = 0.15;

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
}

function couldBeSamePayment(a: FinanceTransaction, b: FinanceTransaction): boolean {
  if (a.type !== b.type) return false;
  if (a.source === b.source) return false;
  if (daysBetween(a.transaction_date, b.transaction_date) > PAIR_MAX_DAYS) return false;

  const whoA = normaliseWho(a);
  const whoB = normaliseWho(b);
  if (whoA.slice(0, PAIR_NAME_PREFIX) !== whoB.slice(0, PAIR_NAME_PREFIX)) return false;

  const amtA = amountOf(a);
  const amtB = amountOf(b);
  return Math.abs(amtA - amtB) <= Math.max(amtA, amtB) * PAIR_AMOUNT_TOLERANCE;
}

/**
 * How well a pair fits, for choosing between competing candidates. Anthropic
 * billed EUR 24.60, EUR 24.60 and EUR 23.38 on one day; every receipt is
 * within tolerance of every bank line, and pairing them off arbitrarily would
 * propose deleting a real payment.
 *
 * Amount decides and the date only breaks ties. Folding the two into one
 * scalar does not do that at any exchange rate: weigh a day against a
 * percentage point and an exact-amount bank line three days out loses to a
 * same-day one that is 2% off, which is the wrong row to offer for deletion
 * and leaves the right one unmatched.
 */
interface PairFit {
  amount: number;
  days: number;
}

function pairFit(a: FinanceTransaction, b: FinanceTransaction): PairFit {
  const amtA = amountOf(a);
  const amtB = amountOf(b);
  return {
    amount: Math.abs(amtA - amtB) / Math.max(amtA, amtB, 1),
    days: daysBetween(a.transaction_date, b.transaction_date),
  };
}

function byFit(x: PairFit, y: PairFit): number {
  return x.amount - y.amount || x.days - y.days;
}

/**
 * Groups of existing rows that look like the same transaction recorded twice.
 *
 * Cross-source pairs are settled first, and the exact key only gets what is
 * left. The order matters and is not a preference. Anthropic billed EUR 24.60
 * twice on 29 June and both payments reached the bank on the 30th: four rows,
 * two real payments. Letting the exact key go first pairs the two receipts
 * with each other and the two bank lines with each other, and then proposes
 * deleting one of each — losing a genuine payment's receipt while leaving the
 * receipt-against-bank duplication it was supposed to find. A receipt and a
 * bank line are one payment; two receipts a vendor issued on one day usually
 * are not.
 *
 * A payment is not always two rows. Anthropic's EUR 18.45 on 5 July is three —
 * the Gmail row, the receipt_log row and the bank line — and stopping at a
 * pair proposes removing one of the three while the ledger still counts the
 * payment twice. So a set grows past two, bounded by the one thing that makes
 * these sets safe: at most one row per source. That bound is what keeps the
 * two genuine EUR 24.60 payments apart, since a second receipt cannot join a
 * set that already holds one.
 */
export function findDuplicateGroups(rows: FinanceTransaction[]): DuplicateGroup[] {
  const matchable = rows.filter(isMatchable);
  const groups: DuplicateGroup[] = [];
  const spent = new Set<string>();

  const candidates: { a: FinanceTransaction; b: FinanceTransaction; fit: PairFit }[] = [];
  for (let i = 0; i < matchable.length; i++) {
    for (let j = i + 1; j < matchable.length; j++) {
      if (couldBeSamePayment(matchable[i], matchable[j])) {
        candidates.push({
          a: matchable[i],
          b: matchable[j],
          fit: pairFit(matchable[i], matchable[j]),
        });
      }
    }
  }

  candidates.sort((x, y) => byFit(x.fit, y.fit));

  const setOf = new Map<string, FinanceTransaction[]>();
  for (const { a, b } of candidates) {
    if (spent.has(a.id) || spent.has(b.id)) continue;
    const set = [a, b];
    spent.add(a.id);
    spent.add(b.id);
    setOf.set(a.id, set);
    setOf.set(b.id, set);
  }

  // The third representation, and any beyond it. A row joins a set only when
  // it fits every member already in it and brings a source none of them has.
  for (const { a, b } of candidates) {
    const set = setOf.get(a.id) ?? setOf.get(b.id);
    if (!set) continue;
    const row = setOf.has(a.id) ? b : a;
    if (spent.has(row.id)) continue;
    if (set.some(m => m.source === row.source)) continue;
    if (!set.every(m => couldBeSamePayment(row, m))) continue;
    set.push(row);
    spent.add(row.id);
    setOf.set(row.id, set);
  }

  for (const set of new Set(setOf.values())) {
    const sorted = [...set].sort((a, b) =>
      evidenceScore(b) - evidenceScore(a) || a.created_at.localeCompare(b.created_at));
    groups.push({
      key: `pair|${sorted.map(r => r.id).join("|")}`,
      keep: sorted[0],
      extras: sorted.slice(1),
    });
  }

  const byKey = new Map<string, FinanceTransaction[]>();
  for (const row of matchable) {
    if (spent.has(row.id)) continue;
    const key = duplicateKey(row);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(row);
  }

  for (const [key, members] of byKey) {
    if (members.length < 2) continue;
    // Richest row first, oldest as the tie-break. Never the other way round:
    // the emptier row is usually the older one.
    const sorted = [...members].sort((a, b) =>
      evidenceScore(b) - evidenceScore(a) || a.created_at.localeCompare(b.created_at));
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
