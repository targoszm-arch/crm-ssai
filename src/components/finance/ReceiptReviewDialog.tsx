import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, FileText, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, VAT_TREATMENT_LABELS } from "./financeUtils";
import { FinanceTransaction } from "./useFinanceTransactions";

interface ReviewForm {
  counterparty_name: string;
  transaction_date: string;
  amount_eur: string;
  vat_treatment: string;
  vat_amount_eur: string;
  description: string;
  category: string;
  notes_text: string;
}

function getPdfPath(tx: FinanceTransaction): string | null {
  if (!tx.notes) return null;
  try {
    const parsed = JSON.parse(tx.notes);
    return parsed.pdf_path ?? null;
  } catch { return null; }
}

function getNotesText(tx: FinanceTransaction): string {
  if (!tx.notes) return "";
  try {
    const parsed = JSON.parse(tx.notes);
    return parsed.hint ?? "";
  } catch { return tx.notes; }
}

function PdfViewer({ pdfPath }: { pdfPath: string | null }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pdfPath) { setPdfUrl(null); return; }
    supabase.storage.from("receipt-pdfs").createSignedUrl(pdfPath, 3600).then(({ data }) => {
      setPdfUrl(data?.signedUrl ?? null);
    });
  }, [pdfPath]);

  if (!pdfPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <FileText className="h-12 w-12 opacity-30" />
        <p className="text-sm">No PDF attachment</p>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <iframe
      src={pdfUrl}
      className="w-full h-full rounded-l-lg border-0"
      title="Receipt PDF"
    />
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ReceiptReviewDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // Fetch unreconciled Gmail transactions
  const { data: receipts = [], isLoading } = useQuery<FinanceTransaction[]>({
    queryKey: ["gmail-receipts-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_transactions")
        .select("*")
        .eq("source", "gmail")
        .eq("is_reconciled", false)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const tx = receipts[index] ?? null;
  const total = receipts.length;

  const { register, handleSubmit, reset, setValue, watch } = useForm<ReviewForm>();

  // Populate form when transaction changes
  useEffect(() => {
    if (!tx) return;
    reset({
      counterparty_name: tx.counterparty_name ?? "",
      transaction_date: tx.transaction_date,
      amount_eur: tx.amount_eur_cents ? String((tx.amount_eur_cents / 100).toFixed(2)) : "",
      vat_treatment: tx.vat_treatment ?? "none",
      vat_amount_eur: tx.vat_amount_cents ? String((tx.vat_amount_cents / 100).toFixed(2)) : "",
      description: tx.description ?? "",
      category: tx.category ?? "none",
      notes_text: getNotesText(tx),
    });
  }, [tx, reset]);

  // Reset index when dialog opens
  useEffect(() => { if (open) setIndex(0); }, [open]);

  const vatTreatment = watch("vat_treatment");

  const onSave = handleSubmit(async (form) => {
    if (!tx) return;
    setSaving(true);
    try {
      const amountCents = Math.round(parseFloat(form.amount_eur || "0") * 100);
      const vatCents = Math.round(parseFloat(form.vat_amount_eur || "0") * 100);

      // Preserve pdf_path in notes
      const pdfPath = getPdfPath(tx);
      const newNotes: Record<string, string> = {};
      if (pdfPath) newNotes.pdf_path = pdfPath;
      if (form.notes_text.trim()) newNotes.hint = form.notes_text.trim();

      const { error } = await supabase.from("finance_transactions").update({
        counterparty_name: form.counterparty_name || null,
        transaction_date: form.transaction_date,
        amount_cents: amountCents,
        amount_eur_cents: amountCents,
        net_cents: amountCents - vatCents,
        vat_treatment: form.vat_treatment === "none" ? null : form.vat_treatment,
        vat_amount_cents: vatCents,
        description: form.description || null,
        category: form.category === "none" ? null : form.category,
        notes: Object.keys(newNotes).length ? JSON.stringify(newNotes) : null,
        is_reconciled: true,
      }).eq("id", tx.id);

      if (error) throw error;

      toast.success("Receipt saved");
      queryClient.invalidateQueries({ queryKey: ["gmail-receipts-queue"] });
      queryClient.invalidateQueries({ queryKey: ["finance_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance_last_synced"] });

      // Move to next
      if (index >= total - 1) {
        onClose();
      } else {
        setIndex(i => i);
      }
    } catch (err) {
      toast.error(`Save failed: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  });

  const handleDelete = async () => {
    if (!tx || !confirm("Delete this receipt?")) return;
    const { error } = await supabase.from("finance_transactions").delete().eq("id", tx.id);
    if (error) { toast.error(String(error.message)); return; }
    toast.success("Receipt deleted");
    queryClient.invalidateQueries({ queryKey: ["gmail-receipts-queue"] });
    queryClient.invalidateQueries({ queryKey: ["finance_transactions"] });
    if (index >= total - 1) onClose();
  };

  const pdfPath = tx ? getPdfPath(tx) : null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 overflow-hidden flex flex-col">
        {/* Title bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Uploaded receipt</h2>
            {total > 0 && (
              <Badge variant="secondary">{index + 1} / {total}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" disabled={index >= total - 1} onClick={() => setIndex(i => i + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
            <FileText className="h-12 w-12 opacity-30" />
            <p className="text-sm font-medium">No receipts to review</p>
            <p className="text-xs">Run "Scan receipts" to pull from Gmail</p>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">
            {/* Left: PDF viewer */}
            <div className="w-[45%] bg-zinc-900 shrink-0">
              <PdfViewer pdfPath={pdfPath} />
            </div>

            {/* Right: Review form */}
            <div className="flex-1 overflow-y-auto">
              <form onSubmit={onSave} className="p-6 space-y-4">
                <div>
                  <p className="text-base font-semibold">Review details</p>
                  <p className="text-sm text-muted-foreground">Double-check the details and add any missing info.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Payee</Label>
                    <Input placeholder="Select a payee (optional)" {...register("counterparty_name")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Payment date *</Label>
                    <Input type="date" {...register("transaction_date")} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Total amount (inclusive of tax)</Label>
                    <Input type="number" step="0.01" placeholder="0.00" {...register("amount_eur")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Tax amount</Label>
                    <Input type="number" step="0.01" placeholder="0.00" {...register("vat_amount_eur")} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Tax type</Label>
                    <Select value={vatTreatment} onValueChange={v => setValue("vat_treatment", v)}>
                      <SelectTrigger><SelectValue placeholder="Select tax rate" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {Object.entries(VAT_TREATMENT_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Account / Category</Label>
                    <Select value={watch("category")} onValueChange={v => setValue("category", v)}>
                      <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Uncategorised —</SelectItem>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Description</Label>
                  <Input {...register("description")} />
                </div>

                <div className="space-y-1">
                  <Label>Ref no.</Label>
                  <Input value={tx?.source_id ?? "Not found"} readOnly className="bg-muted text-muted-foreground text-xs" />
                </div>

                <div className="space-y-1">
                  <Label>Memo</Label>
                  <Textarea rows={3} {...register("notes_text")} />
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bottom bar */}
        {total > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t bg-background shrink-0">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete this receipt</Button>
            <Button onClick={onSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save and next
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
