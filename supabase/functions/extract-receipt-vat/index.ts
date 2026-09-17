/**
 * extract-receipt-vat — reads the VAT off stored receipt PDFs.
 *
 * This is the step the accountant does by hand: open the PDF, find the tax
 * line, write down the figure. It runs over receipts already harvested into
 * storage and records what each document says, how confident it is, and why.
 *
 * It does not overwrite anyone's judgement. A row that already carries a VAT
 * treatment, or that has been reconciled, is left alone — classification is
 * expensive human work and a parser has no business restating it.
 *
 * It also does not decide the hard cases. A treatment is applied only when the
 * arithmetic on the document proves the figure (subtotal + VAT = total, or VAT
 * is the stated rate of the subtotal). Everything else is proposed and left
 * for review, because a wrong VAT3 is worse than a slow one.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";
import { parseReceiptText } from "../_shared/receiptParser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIME_BUDGET_MS = 110_000;

const EU_COUNTRIES = [
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE",
  "IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
];

/**
 * What the document implies, for Irish VAT. Proposed, never imposed.
 *
 * The reverse-charge case is the one worth stating: an EU supplier outside
 * Ireland that charges no VAT and quotes its VAT number is reverse charge, and
 * the Irish business accounts for the VAT on both sides. That is a rule, but
 * it depends on the supply being B2B, which the document does not always say.
 */
function proposeTreatment(f: ReturnType<typeof parseReceiptText>): {
  treatment: string | null;
  note: string;
} {
  const c = f.supplierCountry;
  if (f.vatCents && f.vatCents > 0) {
    if (c === "IE") return { treatment: "standard_23", note: "Irish supplier charging VAT" };
    if (c && EU_COUNTRIES.includes(c)) {
      // Deliberately unclassified. A German supplier charging German VAT is
      // not Irish input VAT and cannot go in T2 — it is reclaimed, if at all,
      // through a cross-border refund. Returning standard_23 with a note
      // saying "check this" was worse than returning nothing, because the
      // caller applies any treatment the arithmetic confirms and the pack
      // then counts it. Confidence in the *number* is not permission to
      // decide the *treatment*.
      return {
        treatment: null,
        note: `${c} supplier charging ${c} VAT — not Irish input VAT; needs a decision`,
      };
    }
    return { treatment: null, note: "VAT charged by a supplier with no EU VAT number — needs a look" };
  }
  if (c && c !== "IE" && EU_COUNTRIES.includes(c)) {
    return { treatment: "reverse_charge", note: `${c} supplier, no VAT charged — reverse charge if this is B2B` };
  }
  if (c === "IE") return { treatment: null, note: "Irish supplier with no VAT line — needs a look" };
  return { treatment: "outside_scope", note: "no EU VAT number and no VAT charged" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = Date.now();

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: authError } = await sb.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const limit: number = Math.min(body.limit ?? 200, 500);
    const dryRun: boolean = body.dry_run === true;
    const ids: string[] | null = body.ids ?? null;

    // Candidates: a row that could actually have a stored PDF, and that
    // nobody has classified yet.
    //
    // Without the source filter this selected every unclassified Revolut,
    // Stripe and manual row too. None of them has a receipt, each one failed
    // the download, and nothing recorded the attempt — so once they filled
    // the first `limit` rows the genuine Gmail receipts behind them were
    // never reached, however many times it was run.
    let q = sb
      .from("finance_transactions")
      .select("id, source, source_id, notes, currency, vat_treatment, is_reconciled, raw_data")
      .eq("user_id", user.id)
      .is("vat_treatment", null)
      .eq("is_reconciled", false)
      .limit(limit);
    // `notes` carries the storage path the harvest wrote, so this is exactly
    // "has a PDF in the bucket". Receipt-log rows are excluded on purpose:
    // their PDFs are in Drive, not storage, so including them would re-create
    // the same clog with a different set of rows.
    if (ids) q = q.in("id", ids);
    else q = q.eq("source", "gmail").like("notes", "%pdf_path%");

    const { data: rows, error } = await q;
    if (error) throw error;

    let read = 0, withVat = 0, applied = 0, needsReview = 0, noPdf = 0;
    const results: Record<string, unknown>[] = [];
    let done = true;

    for (const row of rows ?? []) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) { done = false; break; }

      // Where the harvest put the file.
      let path: string | null = null;
      try {
        const notes = row.notes ? JSON.parse(row.notes) : null;
        path = notes?.pdf_path ?? null;
      } catch { /* notes is prose, not JSON — that is fine */ }
      if (!path && row.source_id) path = `receipts/${user.id}/${row.source_id}.pdf`;
      if (!path) { noPdf++; continue; }

      const { data: file, error: dlErr } = await sb.storage.from("receipt-pdfs").download(path);
      if (dlErr || !file) { noPdf++; continue; }

      let facts;
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pdf = await getDocumentProxy(bytes);
        const { text } = await extractText(pdf, { mergePages: true });
        facts = parseReceiptText(text);
      } catch (e) {
        results.push({ id: row.id, error: `could not read the PDF: ${String(e)}` });
        continue;
      }
      read++;

      const proposal = proposeTreatment(facts);
      const certain = facts.confidence === "high";
      if (facts.vatCents) withVat++;

      const extraction = {
        ...facts,
        proposed_treatment: proposal.treatment,
        proposed_note: proposal.note,
        extracted_at: new Date().toISOString(),
        applied: certain && proposal.treatment !== null && !dryRun,
      };

      results.push({ id: row.id, ...extraction });

      if (dryRun) continue;

      const patch: Record<string, unknown> = {
        raw_data: { ...(row.raw_data ?? {}), extraction },
      };

      if (facts.supplierVatNumber) patch.counterparty_vat_number = facts.supplierVatNumber;
      if (facts.supplierCountry) patch.counterparty_country = facts.supplierCountry;

      if (certain && proposal.treatment) {
        patch.vat_treatment = proposal.treatment;
        patch.vat_amount_cents = facts.vatCents ?? 0;
        // Only a receipt already in euro can have its euro VAT set here.
        // Converting at the right rate for the document's date is the FX
        // step's job, and guessing one would be worse than leaving it null.
        if ((facts.currency ?? row.currency) === "EUR") patch.vat_eur_cents = facts.vatCents ?? 0;
        applied++;
      } else {
        needsReview++;
      }

      const { error: upErr } = await sb.from("finance_transactions").update(patch).eq("id", row.id);
      if (upErr) results.push({ id: row.id, error: upErr.message });
    }

    return new Response(
      JSON.stringify({
        candidates: rows?.length ?? 0,
        read, with_vat: withVat, applied, needs_review: needsReview, no_pdf: noPdf,
        done, dry_run: dryRun,
        message: done
          ? `Read ${read} receipt(s): ${applied} classified, ${needsReview} for review.`
          : `Read ${read} so far — time limit reached, run it again to continue.`,
        results: results.slice(0, 100),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("extract-receipt-vat error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
