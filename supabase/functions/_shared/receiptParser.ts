/**
 * Reads VAT off a receipt's text.
 *
 * Written against Magda's actual receipts rather than an idea of one, which
 * changed the design twice:
 *
 *   * HubSpot's PDF uses subset CID fonts, so the text only exists once a real
 *     PDF engine has applied the ToUnicode map. Regex over the raw stream
 *     returns glyph ids. Hence unpdf/pdf.js upstream of this, not a pattern.
 *
 *   * The receipt is laid out as a table, and extraction emits the label
 *     column and then the value column:
 *
 *         Subtotal / VAT (23%) / Amount Paid / Total Due
 *         €20.00 / €4.60 / (€24.60) / €0.00
 *
 *     "VAT (23%) €4.60" never appears as a run of text. Matching inline works
 *     for the invoices that are laid out inline and fails silently for these,
 *     which is the worst possible failure for a tax return, so when the inline
 *     match misses we align the two columns by position instead.
 *
 * Nothing here decides a VAT treatment on its own. It reports what the
 * document says and how confident it is; a person confirms.
 */

export interface ReceiptFacts {
  currency: string | null;
  /** Gross, in minor units. */
  totalCents: number | null;
  subtotalCents: number | null;
  vatCents: number | null;
  vatRatePercent: number | null;
  /** The supplier's VAT number, when the document carries one. */
  supplierVatNumber: string | null;
  /** Two-letter country inferred from that VAT number. */
  supplierCountry: string | null;
  /** "arithmetic" when subtotal + VAT == total; the strongest signal there is. */
  confidence: "high" | "medium" | "low" | "none";
  /** Why it landed where it did — shown to whoever reviews the row. */
  reason: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR", "$": "USD", "£": "GBP",
};

/**
 * A figure only counts as money when a currency sits against it.
 *
 * The looser "any number on a line that mentions a currency somewhere" rule
 * read HubSpot's footer — "All fees are listed in EUR and are subject to VAT
 * (23%)" — as EUR 23.00 of VAT against a true EUR 4.60. Five times the real
 * figure, from a sentence that is not a number at all. A percentage is never
 * an amount, and prose is never a total line.
 */
export function findMoney(line: string): { cents: number; currency: string | null } | null {
  if (!line) return null;

  const re = /([€$£])\s*([\d][\d.,\s]*)|([\d][\d.,\s]*)\s*(EUR|USD|GBP|PLN|CHF|SEK|DKK|NOK|CAD|AUD)\b/gi;
  for (const m of line.matchAll(re)) {
    const digits = (m[2] ?? m[3] ?? "").trim();
    const code = m[1] ? CURRENCY_SYMBOLS[m[1]] : (m[4] ?? "").toUpperCase();
    // A rate is not an amount.
    const after = line.slice((m.index ?? 0) + m[0].length).trimStart();
    if (after.startsWith("%")) continue;
    const parsed = toCents(digits);
    if (parsed === null) continue;
    return { cents: parsed, currency: code || null };
  }
  return null;
}

/** "1,234.56" / "1.234,56" -> minor units. Sign is dropped. */
function toCents(raw: string): number | null {
  let n = raw.replace(/\s/g, "").replace(/[.,]$/, "");
  if (!/\d/.test(n)) return null;
  const lastComma = n.lastIndexOf(",");
  const lastDot = n.lastIndexOf(".");
  if (lastComma > lastDot) n = n.replace(/\./g, "").replace(",", ".");
  else n = n.replace(/,/g, "");
  const value = parseFloat(n);
  return Number.isNaN(value) ? null : Math.round(Math.abs(value) * 100);
}

/**
 * A total line is a label and a figure, not a sentence. Eight words is
 * generous for "Total Due (including VAT)" and far short of a footer.
 */
function isTerse(line: string): boolean {
  return line.split(/\s+/).length <= 8;
}

/** Labels that mean "this is the tax line", and ones that only look like it. */
const VAT_LABEL = /\b(VAT|V\.A\.T\.|value added tax|sales tax|tax|BTW|MwSt|TVA|IVA)\b/i;
// "Tax ID", "VAT number" and friends are identity, not money.
const NOT_A_VAT_AMOUNT = /\b(number|no\.?|id|reg|registration|exempt|invoice)\b/i;
const SUBTOTAL_LABEL = /\b(subtotal|sub-total|net|amount before tax)\b/i;
const TOTAL_LABEL = /\b(total due|amount due|total|amount paid|grand total)\b/i;

/** A percentage stated beside the tax label, e.g. "VAT (23%)" or "VAT @ 23%". */
function rateFrom(line: string): number | null {
  const m = line.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

/**
 * VAT numbers are country-prefixed in the EU. This reads the prefix only —
 * it deliberately does not validate the number, which is VIES's job.
 */
export function findSupplierVat(text: string): { number: string; country: string } | null {
  const m = text.match(
    /\b(AT|BE|BG|HR|CY|CZ|DK|EE|FI|FR|DE|EL|GR|HU|IE|IT|LV|LT|LU|MT|NL|PL|PT|RO|SK|SI|ES|SE|XI|GB)[\s-]?([0-9A-Z][0-9A-Z\s-]{6,13})\b/,
  );
  if (!m) return null;
  const country = m[1] === "EL" ? "GR" : m[1];
  return { number: (m[1] + m[2]).replace(/[\s-]/g, ""), country };
}

export function parseReceiptText(text: string): ReceiptFacts {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const vatNum = findSupplierVat(text);
  let currency: string | null = null;
  let vatCents: number | null = null;
  let vatRatePercent: number | null = null;
  let subtotalCents: number | null = null;
  let totalCents: number | null = null;
  let how = "";

  const take = (line: string) => {
    const money = findMoney(line);
    if (money?.currency && !currency) currency = money.currency;
    return money;
  };

  // Pass 1 — label and amount on the same line.
  for (const line of lines) {
    const hasMoney = isTerse(line) && findMoney(line) !== null;
    if (VAT_LABEL.test(line) && !NOT_A_VAT_AMOUNT.test(line) && hasMoney) {
      const m = take(line);
      if (m && vatCents === null) {
        vatCents = m.cents;
        vatRatePercent = rateFrom(line);
        how = "label and amount on one line";
      }
    } else if (SUBTOTAL_LABEL.test(line) && hasMoney && subtotalCents === null) {
      subtotalCents = take(line)?.cents ?? null;
    } else if (TOTAL_LABEL.test(line) && hasMoney && totalCents === null) {
      totalCents = take(line)?.cents ?? null;
    }
  }

  // Pass 2 — a label column followed by a value column, aligned by position.
  // This is how HubSpot, Stripe and anything built as a table extract.
  //
  // The block must be contiguous. A first attempt collected every label-ish
  // line on the page, so "Amount Paid (EUR)" in the header and "ITEM TOTAL" in
  // the table head were paired with the totals block's figures and the answer
  // came out as someone else's numbers. A summary table is a run of labels
  // immediately followed by a run of figures; anything else is not one.
  if (vatCents === null) {
    const isLabel = (l: string) => !/^[(]?\s*[€$£]?\s*[\d.,]+\s*(EUR|USD|GBP)?\s*[)]?$/i.test(l)
      && findMoney(l) === null && isTerse(l);
    const isValue = (l: string) =>
      /^[(]?\s*[€$£]?\s*[\d.,]+\s*(EUR|USD|GBP)?\s*[)]?$/i.test(l) && /\d/.test(l);

    for (let i = 0; i < lines.length; i++) {
      if (!isLabel(lines[i])) continue;
      let labelEnd = i;
      while (labelEnd + 1 < lines.length && isLabel(lines[labelEnd + 1])) labelEnd++;

      const labels = lines.slice(i, labelEnd + 1);
      const values: string[] = [];
      for (let j = labelEnd + 1; j < lines.length && isValue(lines[j]); j++) values.push(lines[j]);

      const vatAt = labels.findIndex(l => VAT_LABEL.test(l) && !NOT_A_VAT_AMOUNT.test(l));
      if (vatAt === -1 || values.length < labels.length) { i = labelEnd; continue; }

      const money = take(values[vatAt]);
      if (money) {
        vatCents = money.cents;
        vatRatePercent = rateFrom(labels[vatAt]);
        how = "label column aligned with value column";

        const subAt = labels.findIndex(l => SUBTOTAL_LABEL.test(l));
        if (subAt !== -1) subtotalCents = take(values[subAt])?.cents ?? subtotalCents;
        const totAt = labels.findIndex(l => TOTAL_LABEL.test(l));
        if (totAt !== -1) totalCents = take(values[totAt])?.cents ?? totalCents;
      }
      break;
    }
  }

  // The rate may be stated anywhere ("VAT (23%)" in a heading).
  if (vatRatePercent === null) {
    const rateLine = lines.find(l => VAT_LABEL.test(l) && /%/.test(l));
    if (rateLine) vatRatePercent = rateFrom(rateLine);
  }

  // Confidence. Arithmetic beats pattern matching: if subtotal + VAT is the
  // total, the three numbers are describing each other and cannot all be wrong.
  let confidence: ReceiptFacts["confidence"] = "none";
  let reason = "no VAT line found";

  if (vatCents !== null) {
    if (subtotalCents !== null && totalCents !== null
        && Math.abs(subtotalCents + vatCents - totalCents) <= 2) {
      confidence = "high";
      reason = `subtotal + VAT = total (${how})`;
    } else if (vatRatePercent !== null && subtotalCents !== null
        && Math.abs(Math.round(subtotalCents * vatRatePercent / 100) - vatCents) <= 2) {
      confidence = "high";
      reason = `VAT is ${vatRatePercent}% of the subtotal (${how})`;
    } else if (vatRatePercent !== null) {
      confidence = "medium";
      reason = `VAT line with a stated rate, unchecked against the total (${how})`;
    } else {
      confidence = "low";
      reason = `VAT line found but nothing corroborates it (${how})`;
    }
  } else if (totalCents !== null) {
    reason = "a total, but no VAT line — likely a receipt with no VAT charged";
  }

  return {
    currency,
    totalCents,
    subtotalCents,
    vatCents,
    vatRatePercent,
    supplierVatNumber: vatNum?.number ?? null,
    supplierCountry: vatNum?.country ?? null,
    confidence,
    reason,
  };
}
