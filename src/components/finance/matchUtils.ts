import { FinanceTransaction } from "@/components/finance/useFinanceTransactions";
import { normaliseWho } from "@/components/finance/duplicateUtils";

/**
 * Pairing a bank line with the receipt that documents it.
 *
 * The two halves of a VAT claim live in different rows. The bank line proves
 * the money moved and carries the date Revenue cares about; the receipt
 * carries the VAT, the supplier's country and the PDF. Today the pairing
 * exists only while the accountant holds two lists side by side.
 *
 * Measured against the live table: of 115 receipts carrying an amount, 24 have
 * a bank line at the same euro figure within five days, and 54 sit within 2%.
 * The distance between those numbers is the whole difficulty — 2% of a EUR 25
 * subscription is 50 cents, and so is the gap between two unrelated
 * subscriptions billed the same week. So this scores and proposes; a person
 * confirms. Nothing here writes a match on its own.
 */

/** Sources that are bank movements rather than documents. */
const BANK_SOURCES = new Set(["revolut", "n26", "stripe", "paypal"]);
/** Sources that are documents rather than movements. */
const RECEIPT_SOURCES = new Set(["gmail", "receipt_log"]);

export function isBankRow(tx: FinanceTransaction): boolean {
  return BANK_SOURCES.has(tx.source);
}
export function isReceiptRow(tx: FinanceTransaction): boolean {
  return RECEIPT_SOURCES.has(tx.source);
}

/** Euro cents, absolute. Sign lives in `type`, not in the amount. */
export function eurOf(tx: FinanceTransaction): number {
  return Math.abs(tx.amount_eur_cents ?? tx.amount_cents);
}

export function daysBetween(a: string, b: string): number {
  return Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000);
}

/**
 * Do two counterparty strings refer to the same supplier?
 *
 * Deliberately crude — containment after stripping punctuation — because the
 * real pairs in this data are crude: "anam.ai" against "Anam",
 * "Anthropic Ireland, Limited" against "anthropic", "github" against
 * "[GitHub] Payment Receipt for targoszm-arch". A similarity metric would
 * score those no better and would also score unrelated names, which is worse.
 *
 * Three characters minimum, so "fin" cannot swallow "finance" and an empty
 * name cannot match everything.
 */
export function namesAgree(a: string, b: string): boolean {
  if (a.length < 3 || b.length < 3) return false;
  return a.includes(b) || b.includes(a);
}

export interface MatchCandidate {
  bank: FinanceTransaction;
  receipt: FinanceTransaction;
  /** 0-100. Above CONFIDENT is "almost certainly the same payment". */
  score: number;
  reasons: string[];
}

/** A pair at or above this is worth showing first; still confirmed by a human. */
export const CONFIDENT = 80;
/** Below this it is noise and is not proposed at all. */
export const FLOOR = 45;

const MAX_DAYS = 7;

/**
 * Score one candidate pair.
 *
 * The amount does the work and the name breaks ties, because amounts collide
 * far more often than names do. A pair with neither an exact amount nor an
 * agreeing name cannot reach the floor, which is the intended outcome.
 */
export function scorePair(bank: FinanceTransaction, receipt: FinanceTransaction): MatchCandidate | null {
  // Both sides must be in euro before they can be compared.
  //
  // `eurOf` falls back to amount_cents when amount_eur_cents is null, which is
  // correct only when the row is already in euro. The guard used to check the
  // bank row alone, so a USD receipt with no euro figure had its *dollar*
  // minor units compared against euro cents — inventing confident pairs at a
  // ~15% error and hiding the genuine ones. Every row needs its own check.
  const comparable = (t: FinanceTransaction) => t.currency === "EUR" || t.amount_eur_cents != null;
  if (!comparable(bank) || !comparable(receipt)) return null;

  const bankEur = eurOf(bank);
  const recEur = eurOf(receipt);
  if (!bankEur || !recEur) return null;

  const days = daysBetween(bank.transaction_date, receipt.transaction_date);
  if (days > MAX_DAYS) return null;

  const reasons: string[] = [];
  let score = 0;

  // --- amount ---
  const diff = Math.abs(bankEur - recEur);
  const pct = diff / Math.max(bankEur, recEur);
  if (diff <= 2) {
    score += 55;
    reasons.push("same euro amount");
  } else if (pct <= 0.02) {
    // A receipt converted at the ECB rate and a bank line converted at
    // Revolut's differ by well under 2%. That is the honest reason to allow
    // any tolerance at all, and the reason it is this small.
    score += 35;
    reasons.push(`amounts within ${(pct * 100).toFixed(1)}%`);
  } else {
    return null;
  }

  // --- date ---
  if (days === 0) { score += 25; reasons.push("same day"); }
  else if (days <= 2) { score += 18; reasons.push(`${days} day${days > 1 ? "s" : ""} apart`); }
  else { score += 8; reasons.push(`${days} days apart`); }

  // --- name ---
  const bn = normaliseWho(bank);
  const rn = normaliseWho(receipt);
  if (bn && rn && namesAgree(bn, rn)) {
    score += 25;
    reasons.push("supplier name matches");
  }

  // --- direction ---
  // An expense receipt against money coming in is not the same event, however
  // well the numbers line up.
  const bankOut = bank.type === "expense" || bank.type === "fee";
  const recOut = receipt.type === "expense" || receipt.type === "fee";
  if (bankOut !== recOut) {
    score -= 30;
    reasons.push("directions disagree");
  }

  score = Math.max(0, Math.min(100, score));
  return score >= FLOOR ? { bank, receipt, score, reasons } : null;
}

/**
 * Best proposals across the whole ledger, one per row.
 *
 * Greedy by score: the strongest pair claims both its rows, then the next
 * strongest among what is left. A receipt cannot be offered against two bank
 * lines, which is what stops one Anthropic subscription from appearing to
 * document every Anthropic charge in the month.
 */
export function proposeMatches(
  txs: FinanceTransaction[],
  alreadyPaired: Set<string> = new Set(),
): MatchCandidate[] {
  const banks = txs.filter(t => isBankRow(t) && t.type !== "transfer" && !alreadyPaired.has(t.id));
  const receipts = txs.filter(t => isReceiptRow(t) && !alreadyPaired.has(t.id));

  // Bucket by date so this stays near-linear instead of 726 x 168.
  const byDay = new Map<string, FinanceTransaction[]>();
  for (const r of receipts) {
    const list = byDay.get(r.transaction_date) ?? [];
    list.push(r);
    byDay.set(r.transaction_date, list);
  }

  const all: MatchCandidate[] = [];
  for (const b of banks) {
    const base = Date.parse(b.transaction_date);
    for (let d = -MAX_DAYS; d <= MAX_DAYS; d++) {
      const key = new Date(base + d * 86_400_000).toISOString().slice(0, 10);
      for (const r of byDay.get(key) ?? []) {
        const c = scorePair(b, r);
        if (c) all.push(c);
      }
    }
  }

  all.sort((a, b) =>
    b.score - a.score ||
    daysBetween(a.bank.transaction_date, a.receipt.transaction_date) -
    daysBetween(b.bank.transaction_date, b.receipt.transaction_date));

  const takenBank = new Set<string>();
  const takenReceipt = new Set<string>();
  const out: MatchCandidate[] = [];
  for (const c of all) {
    if (takenBank.has(c.bank.id) || takenReceipt.has(c.receipt.id)) continue;
    takenBank.add(c.bank.id);
    takenReceipt.add(c.receipt.id);
    out.push(c);
  }
  return out;
}

/**
 * Bank spending with no receipt behind it.
 *
 * The number that matters for a VAT return: input VAT needs a document, and
 * this is the list of payments that do not have one.
 */
export function unreceiptedSpend(
  txs: FinanceTransaction[],
  pairedBankIds: Set<string>,
): { rows: FinanceTransaction[]; eurCents: number } {
  const rows = txs.filter(t =>
    isBankRow(t) && (t.type === "expense" || t.type === "fee") && !pairedBankIds.has(t.id));
  return { rows, eurCents: rows.reduce((s, t) => s + eurOf(t), 0) };
}
