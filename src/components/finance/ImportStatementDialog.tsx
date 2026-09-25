import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { centsToEur } from "@/components/finance/financeUtils";
import { findIncomingDuplicates } from "@/components/finance/duplicateUtils";
import { DuplicateReviewDialog, DuplicateReviewItem } from "@/components/finance/DuplicateReviewDialog";
import { FinanceTransaction } from "@/components/finance/useFinanceTransactions";

/**
 * Import a Revolut, N26 or PayPal statement export.
 *
 * This exists because the API route needs a key that may never be issued —
 * Revolut Business API access is a paid plan feature — and a statement CSV is
 * the same money either way. It is not a fallback: for a business that files
 * bi-monthly, downloading two statements is a perfectly good workflow.
 *
 * Rows are keyed by a hash of the line's own identifying fields, so importing
 * overlapping date ranges twice updates rather than duplicates. Getting this
 * wrong is how a pipeline counts the same money twice.
 */

type SourceKind = "revolut" | "paypal" | "n26";

interface ParsedRow {
  source_id: string;
  transaction_date: string;
  description: string;
  counterparty_name: string | null;
  amount_cents: number;
  currency: string;
  amount_eur_cents: number | null;
  fee_cents: number;
  type: "income" | "expense" | "refund" | "fee" | "transfer";
  /** A card payment's original currency and amount, where it was not EUR. */
  original?: { currency: string; amount: string };
  /** N26 only: which account or Space in the export the line belongs to. */
  account?: string;
}

/** Minimal RFC4180 splitter — quoted fields may contain commas and newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { row.push(field); field = ""; continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ""));
}

function findCol(headers: string[], ...candidates: string[]): number {
  const norm = headers.map(h => h.trim().toLowerCase());
  for (const c of candidates) {
    const i = norm.indexOf(c.toLowerCase());
    if (i !== -1) return i;
  }
  // Fall back to a contains match — exporters rename columns between versions.
  for (const c of candidates) {
    const i = norm.findIndex(h => h.includes(c.toLowerCase()));
    if (i !== -1) return i;
  }
  return -1;
}

/**
 * Exact header match only. `findCol` falls back to a substring test, which is
 * right for descriptive columns and badly wrong for an identity column: "ID"
 * would match "Paid ID", "Balance ID", anything.
 */
function findExactCol(headers: string[], ...candidates: string[]): number {
  const norm = headers.map(h => h.trim().toLowerCase());
  for (const c of candidates) {
    const i = norm.indexOf(c.toLowerCase());
    if (i !== -1) return i;
  }
  return -1;
}

function toCents(raw: string): number {
  if (!raw) return 0;
  // Strip currency symbols and thousands separators; accept comma decimals.
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return 0;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalised = cleaned;
  if (lastComma > lastDot) normalised = cleaned.replace(/\./g, "").replace(",", ".");
  else normalised = cleaned.replace(/,/g, "");
  const n = parseFloat(normalised);
  return Number.isNaN(n) ? 0 : Math.round(n * 100);
}

function toDate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Already ISO-ish
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // DD/MM/YYYY — PayPal's European exports
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function hashId(prefix: string, parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join("|"));
  const digest = await crypto.subtle.digest("SHA-1", data);
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex.slice(0, 20)}`;
}

/**
 * An N26 export announces itself: "Booking Date" and "Amount (EUR)" appear in
 * no Revolut or PayPal file. Detected rather than chosen, because the first
 * N26 file went in under Revolut and nothing stopped it.
 */
function isN26(headers: string[]): boolean {
  const norm = headers.map(h => h.trim().toLowerCase());
  return norm.includes("booking date") && norm.includes("amount (eur)");
}

/**
 * N26 needs its own mapping, not the generic column guesser.
 *
 * "Amount (EUR)" is always the euro amount that left the account. The
 * generic guesser found "Original Currency" for the currency column, so a
 * USD 100 card payment was stored as 85.47 *USD* — and the FX sync then
 * converted 85.47 to euro a second time. The currency of an N26 row is EUR,
 * full stop; the card's original currency is kept in raw_data.
 *
 * Transfers between N26 Spaces ("Instant Savings", "Main Account", "Bills")
 * are recognised structurally: a transfer with no partner IBAN cannot have
 * gone to anybody outside the account. Every external transfer carries one.
 */
async function parseN26(rows: string[][]): Promise<ParsedRow[]> {
  const headers = rows[0];
  const col = (name: string) => findExactCol(headers, name);
  const dateCol = col("Booking Date");
  const nameCol = col("Partner Name");
  const ibanCol = col("Partner Iban");
  const typeCol = col("Type");
  const refCol = col("Payment Reference");
  const amtCol = col("Amount (EUR)");
  const origAmtCol = col("Original Amount");
  const origCurCol = col("Original Currency");
  const accountCol = col("Account Name");

  const out: ParsedRow[] = [];
  const occurrences = new Map<string, number>();

  for (const r of rows.slice(1)) {
    const date = toDate(r[dateCol] ?? "");
    if (!date) continue;
    const signed = toCents(r[amtCol] ?? "");
    if (signed === 0) continue;

    const description = (refCol !== -1 ? r[refCol] ?? "" : "").trim() || "(no description)";
    const counterparty = (nameCol !== -1 ? r[nameCol] ?? "" : "").trim() || null;
    const rawType = (typeCol !== -1 ? r[typeCol] ?? "" : "").trim().toLowerCase();
    const iban = (ibanCol !== -1 ? r[ibanCol] ?? "" : "").trim();
    const amount = Math.abs(signed);

    let type: ParsedRow["type"];
    if (rawType.includes("refund")) type = "refund";
    else if (rawType.includes("transfer") && !iban) type = "transfer";
    else type = signed > 0 ? "income" : "expense";

    // Direction is not in the key: a stored row keeps only the absolute
    // amount, and the key has to be recomputable from what is stored (the
    // migration that relabelled the first N26 import does exactly that).
    const baseKey = [date, description, String(amount), counterparty ?? ""];
    const seen = (occurrences.get(baseKey.join("|")) ?? 0) + 1;
    occurrences.set(baseKey.join("|"), seen);
    const sourceId = await hashId("n26", seen === 1 ? baseKey : [...baseKey, `#${seen}`]);

    const origCur = (origCurCol !== -1 ? r[origCurCol] ?? "" : "").trim().toUpperCase();
    out.push({
      source_id: sourceId,
      transaction_date: date,
      description,
      counterparty_name: counterparty,
      amount_cents: amount,
      currency: "EUR",
      amount_eur_cents: amount,
      fee_cents: 0,
      type,
      original: origCur && origCur !== "EUR"
        ? { currency: origCur, amount: (r[origAmtCol] ?? "").trim() }
        : undefined,
      account: accountCol !== -1 ? (r[accountCol] ?? "").trim() || undefined : undefined,
    });
  }
  return out;
}

async function parseStatement(text: string, kind: SourceKind): Promise<ParsedRow[]> {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0];
  if (kind === "n26") return parseN26(rows);

  const dateCol = findCol(headers, "Date completed (UTC)", "Completed Date", "Date completed", "Date");
  const descCol = findCol(headers, "Description", "Reference", "Item Title", "Subject");
  const nameCol = findCol(headers, "Payer", "Beneficiary", "Counterparty", "Name", "Merchant");
  const curCol  = findCol(headers, "Payment currency", "Currency", "Orig currency");
  const amtCol  = findCol(headers, "Amount", "Gross", "Orig amount");
  const feeCol  = findCol(headers, "Fee");
  const typeCol = findCol(headers, "Type");
  const stateCol = findCol(headers, "State", "Status");
  // A provider-assigned id is the only file-independent identity a statement
  // offers. PayPal exports carry "Transaction ID"; some Revolut exports carry
  // an id or reference column. When one exists, everything below about
  // occurrence counting is moot.
  const idCol = findExactCol(
    headers, "Transaction ID", "Transaction reference", "Reference ID",
    "Payment ID", "Transaction id", "ID",
  );

  if (dateCol === -1 || amtCol === -1) {
    throw new Error(
      `Could not find a date and amount column. Found: ${headers.join(", ")}`,
    );
  }

  const out: ParsedRow[] = [];
  // How many times each identifying key has been seen so far in this file.
  const occurrences = new Map<string, number>();

  for (const r of rows.slice(1)) {
    const date = toDate(r[dateCol] ?? "");
    if (!date) continue;

    // Only completed money moves. A pending or reverted line is not a cost.
    const state = (stateCol !== -1 ? r[stateCol] ?? "" : "").trim().toLowerCase();
    if (state && !["completed", "complete", "success", "successful", "s"].includes(state)) continue;

    const amountCents = toCents(r[amtCol] ?? "");
    if (amountCents === 0) continue;

    const currency = ((curCol !== -1 ? r[curCol] : "") || "EUR").trim().toUpperCase().slice(0, 3);
    const description = (descCol !== -1 ? r[descCol] ?? "" : "").trim() || "(no description)";
    const counterparty = (nameCol !== -1 ? r[nameCol] ?? "" : "").trim() || null;
    const rawType = (typeCol !== -1 ? r[typeCol] ?? "" : "").trim().toLowerCase();

    let type: ParsedRow["type"];
    if (rawType.includes("refund")) type = "refund";
    else if (rawType.includes("fee")) type = "fee";
    else type = amountCents > 0 ? "income" : "expense";

    // Identity, best available first.
    //
    // A provider transaction id is stable no matter which export it arrives
    // in, so overlapping date ranges reconcile correctly. It is stored
    // verbatim, not hashed, because the API sync stores Revolut's id verbatim
    // too — that is what makes a transaction imported from a statement and
    // the same transaction pulled from the API one row instead of two.
    //
    // Without one, identity has to come from the row's own contents — and two
    // byte-identical lines are legitimate (a subscription charged twice in a
    // day, a split payment), so the nth occurrence gets its own id. That
    // counter restarts per file, which is exact for the normal case of
    // whole-day exports (every row sharing a key shares its date, so any
    // export covering that date contains all of them) but can mis-pair if an
    // export boundary ever splits a same-day, same-amount set. Nothing in the
    // file can distinguish those rows, so this is the floor, not a choice.
    const providerId = idCol !== -1 ? (r[idCol] ?? "").trim() : "";

    let sourceId: string;
    if (providerId) {
      sourceId = providerId;
    } else {
      const baseKey = [date, description, String(amountCents), currency, counterparty ?? ""];
      const seen = (occurrences.get(baseKey.join("|")) ?? 0) + 1;
      occurrences.set(baseKey.join("|"), seen);
      sourceId = await hashId(kind, seen === 1 ? baseKey : [...baseKey, `#${seen}`]);
    }

    out.push({
      source_id: sourceId,
      transaction_date: date,
      description,
      counterparty_name: counterparty,
      amount_cents: Math.abs(amountCents),
      currency,
      amount_eur_cents: currency === "EUR" ? Math.abs(amountCents) : null,
      fee_cents: feeCol !== -1 ? Math.abs(toCents(r[feeCol] ?? "")) : 0,
      type,
    });
  }
  return out;
}

export function ImportStatementDialog() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SourceKind>("revolut");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  // Everything the file parsed to, before the account filter below.
  const [parsedAll, setParsedAll] = useState<ParsedRow[]>([]);
  const [accounts, setAccounts] = useState<{ name: string; count: number }[]>([]);
  const [chosenAccounts, setChosenAccounts] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [dupItems, setDupItems] = useState<DuplicateReviewItem[]>([]);
  const [dupOpen, setDupOpen] = useState(false);
  const qc = useQueryClient();

  const onFile = async (file: File) => {
    try {
      const text = await file.text();
      // The file decides, not the picker: an N26 export parsed as Revolut
      // is how the first one got its currencies wrong.
      const firstLine = parseCsv(text.split("\n", 1)[0] ?? "")[0] ?? [];
      const detected: SourceKind = isN26(firstLine) ? "n26" : kind === "n26" ? "revolut" : kind;
      if (detected !== kind) {
        setKind(detected);
        if (detected === "n26") toast.info("This is an N26 export — importing it as N26.");
      }
      const parsed = await parseStatement(text, detected);

      // Which account each line came from. An N26 export can hold every
      // account and Space the login can see — the second N26 file uploaded
      // was 490 lines of a personal account (Bills, Living Expenses,
      // Healthcare) and not one line of the company's, and nothing here
      // looked. With one account in the file it is pre-selected; with more,
      // none is, and she ticks the business one before anything imports.
      const counts = new Map<string, number>();
      for (const r of parsed) if (r.account) counts.set(r.account, (counts.get(r.account) ?? 0) + 1);
      const found = [...counts.entries()].map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      const chosen = new Set(found.length === 1 ? [found[0].name] : []);
      setAccounts(found);
      setChosenAccounts(chosen);
      setParsedAll(parsed);
      setRows(found.length === 0 ? parsed : parsed.filter(r => r.account && chosen.has(r.account)));
      setFileName(file.name);
      if (parsed.length === 0) toast.warning("No completed transactions found in that file.");
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
      setRows([]);
      setParsedAll([]);
      setAccounts([]);
    }
  };

  const toggleAccount = (name: string, on: boolean) => {
    const next = new Set(chosenAccounts);
    if (on) next.add(name); else next.delete(name);
    setChosenAccounts(next);
    setRows(parsedAll.filter(r => r.account && next.has(r.account)));
  };

  /** Writes the given rows. Everything about identity is decided upstream. */
  const insertRows = async (toInsert: ParsedRow[]) => {
    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const payload = toInsert.map(r => ({
        user_id: user.id,
        source: kind,
        source_id: r.source_id,
        type: r.type,
        amount_cents: r.amount_cents,
        currency: r.currency,
        amount_eur_cents: r.amount_eur_cents,
        stripe_fee_cents: r.fee_cents,
        net_cents: r.amount_eur_cents,
        transaction_date: r.transaction_date,
        description: r.description,
        subject: r.description,
        counterparty_name: r.counterparty_name,
        is_reconciled: false,
        raw_data: {
          imported_from: fileName,
          ...(r.account ? { account_name: r.account } : {}),
          ...(r.original ? { original_currency: r.original.currency, original_amount: r.original.amount } : {}),
        },
      }));

      // Postgres rejects an ON CONFLICT DO UPDATE that would affect the same
      // row twice, so the batch must be unique on source_id before it is sent.
      const deduped = Array.from(
        new Map(payload.map(r => [r.source_id, r])).values(),
      );

      if (deduped.length === 0) {
        toast.info("Nothing left to import — every row was skipped.");
      } else {
        // ignoreDuplicates => ON CONFLICT DO NOTHING. A statement line is a
        // fact that does not change once it has cleared, whereas the accounting
        // category, tax rate, VAT treatment and reconciled flag on that row are
        // a person's work. DO UPDATE would send this file's blank values over
        // the top of them, so re-importing an overlapping period would quietly
        // undo an afternoon of classifying. New rows land; existing rows are
        // left exactly as they are.
        const { error } = await supabase
          .from("finance_transactions")
          .upsert(deduped, { onConflict: "source,source_id", ignoreDuplicates: true });
        if (error) throw error;
        toast.success(`Imported ${deduped.length} ${kind} transactions`);
      }

      qc.invalidateQueries({ queryKey: ["finance_transactions"] });
      setDupOpen(false);
      setDupItems([]);
      setOpen(false);
      setRows([]);
      setParsedAll([]);
      setAccounts([]);
      setFileName(null);
    } catch (e) {
      toast.error(`Import failed: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setImporting(false);
    }
  };

  /**
   * Check before writing, not after. Anything that looks like money already
   * recorded is put to her one row at a time; a clean file goes straight in.
   */
  const doImport = async () => {
    setImporting(true);
    try {
      const { data: existing, error } = await supabase
        .from("finance_transactions")
        .select("*");
      if (error) throw error;

      // A row whose exact id is already stored is the same statement line
      // imported before. The database would ignore it anyway, so it is not a
      // question worth asking — putting 299 of those to her one at a time,
      // defaulted to Skip, is what made an overlapping file look rejected.
      const stored = new Set(
        ((existing ?? []) as FinanceTransaction[])
          .filter(t => t.source === kind && t.source_id)
          .map(t => t.source_id as string),
      );
      // Lines she deleted stay deleted. A delete leaves a tombstone
      // (finance_sync_tombstones); without this check a re-imported statement
      // would put every deleted line straight back, since a missing row has
      // nothing for the upsert to conflict with.
      const { data: tombs, error: tombErr } = await supabase
        .from("finance_sync_tombstones")
        .select("source_id")
        .eq("source", kind);
      if (tombErr) throw tombErr;
      const deleted = new Set((tombs ?? []).map(t => t.source_id as string));

      const fresh = rows.filter(r => !stored.has(r.source_id) && !deleted.has(r.source_id));
      const skippedDeleted = rows.filter(r => !stored.has(r.source_id) && deleted.has(r.source_id)).length;
      const already = rows.length - fresh.length - skippedDeleted;
      const note = [
        already > 0 ? `${already} already imported` : "",
        skippedDeleted > 0 ? `${skippedDeleted} you deleted before, left out` : "",
      ].filter(Boolean).join("; ");
      if (fresh.length === 0) {
        toast.info(`Nothing new in this file — ${note || "every row is already imported"}.`);
        return;
      }
      if (note) toast.info(`${note}; checking the other ${fresh.length}.`);
      setRows(fresh);

      const dups = findIncomingDuplicates(fresh, (existing ?? []) as FinanceTransaction[], kind);
      if (dups.length === 0) {
        await insertRows(fresh);
        return;
      }

      setDupItems(dups.map(d => ({
        key: String(d.index),
        candidate: {
          date: d.row.transaction_date,
          who: d.row.counterparty_name ?? d.row.description ?? "—",
          amountCents: d.row.amount_cents,
          currency: d.row.currency,
          type: d.row.type,
          note: `In this file${d.repeatsIndex !== null ? ` · repeats line ${d.repeatsIndex + 1}` : ""}`,
        },
        matches: d.existing.map(m => ({
          date: m.transaction_date,
          who: m.counterparty_name ?? m.description ?? "—",
          amountCents: m.amount_eur_cents ?? m.amount_cents,
          currency: m.currency,
          type: m.type,
          note: `Already stored from ${m.source}, added ${m.created_at.slice(0, 10)}`
            + (m.is_reconciled ? " · reconciled" : ""),
        })),
        certain: d.sameSourceId,
      })));
      setDupOpen(true);
    } catch (e) {
      toast.error(`Import failed: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setImporting(false);
    }
  };

  /** Declined rows are simply not written; approved ones join the import. */
  const applyDuplicateDecisions = (declined: Set<string>) => {
    // Indices refer to `rows` as narrowed in doImport, which set it before
    // opening this dialog.
    const skip = new Set([...declined].map(Number));
    void insertRows(rows.filter((_, i) => !skip.has(i)));
  };

  const total = rows.reduce(
    (s, r) => r.type === "transfer" ? s
      : s + (r.type === "expense" || r.type === "fee" ? -1 : 1) * (r.amount_eur_cents ?? r.amount_cents),
    0,
  );

  return (
    <>
    <DuplicateReviewDialog
      open={dupOpen}
      onOpenChange={setDupOpen}
      title="Some of these look like money already recorded"
      description={
        "Same day, same amount, same counterparty as a row you already have — or as an "
        + "earlier line in this file. That is a filter, not a verdict: two genuine identical "
        + "payments on one day look exactly like this. Skip the ones that are duplicates; "
        + "add the ones that are not."
      }
      items={dupItems}
      approveLabel="Add"
      declineLabel="Skip"
      defaultDecision="decline"
      busy={importing}
      onConfirm={applyDuplicateDecisions}
    />
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Import statement
        </Button>
      </DialogTrigger>
      {/* Tall dialogs need a cap and a scrolling body, or the action row goes
          off-screen — see the AddDealModal note in CLAUDE.md. */}
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Import a bank statement</DialogTitle>
          <DialogDescription>
            Upload a Revolut Business, N26 or PayPal CSV export (N26 files are recognised automatically). Rows are matched on their own
            contents, so re-importing an overlapping period updates instead of duplicating.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Select value={kind} onValueChange={v => { setKind(v as SourceKind); setRows([]); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="revolut">Revolut</SelectItem>
              <SelectItem value="n26">N26</SelectItem>
              <SelectItem value="paypal">PayPal</SelectItem>
            </SelectContent>
          </Select>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
          />
          {rows.length > 0 && (
            <Badge variant="secondary">{rows.length} rows · net {centsToEur(total)}</Badge>
          )}
        </div>

        {accounts.length > 0 && (
          <div className={`shrink-0 rounded-md border p-3 text-sm ${
            accounts.length > 1 ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : ""}`}>
            {accounts.length > 1 ? (
              <p className="mb-2 font-medium">
                This file holds {accounts.length} accounts. Tick only the company's —
                personal accounts and Spaces do not belong in the books.
              </p>
            ) : (
              <p className="mb-2 text-muted-foreground">
                Account in this file — untick it if it is not the company's.
              </p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {accounts.map(a => (
                <label key={a.name} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={chosenAccounts.has(a.name)}
                    onCheckedChange={v => toggleAccount(a.name, v === true)}
                  />
                  {a.name} <span className="text-muted-foreground">({a.count})</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto rounded-md border">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {parsedAll.length > 0
                ? "No account selected — tick the company's account above."
                : "Choose a CSV to preview what will be imported."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Cur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 200).map(r => (
                  <TableRow key={r.source_id}>
                    <TableCell className="whitespace-nowrap text-sm">{r.transaction_date}</TableCell>
                    <TableCell className="max-w-[260px]">
                      <span className="block truncate text-sm">{r.description}</span>
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      <span className="block truncate text-sm">{r.counterparty_name ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{r.type}</TableCell>
                    <TableCell className="text-right text-sm">{centsToEur(r.amount_cents)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.currency}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="shrink-0">
          {rows.length > 200 && (
            <span className="mr-auto self-center text-xs text-muted-foreground">
              Showing first 200 of {rows.length}; all will be imported.
            </span>
          )}
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={doImport} disabled={rows.length === 0 || importing}>
            {importing ? "Importing…" : `Import ${rows.length || ""} rows`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
