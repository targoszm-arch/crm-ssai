import { useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useAddTransaction } from "./useFinanceTransactions";
import { CATEGORIES } from "./financeUtils";
import { toast } from "sonner";

interface FormValues {
  transaction_date: string;
  type: "income" | "expense" | "refund" | "fee";
  source: "stripe" | "revolut" | "paypal" | "manual";
  description: string;
  counterparty_name: string;
  counterparty_country: string;
  amount_eur: string;
  vat_treatment: string;
  vat_amount_eur: string;
  category: string;
  notes: string;
}

export function AddTransactionDialog() {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      transaction_date: new Date().toISOString().split("T")[0],
      type: "expense",
      source: "manual",
      vat_treatment: "outside_scope",
      vat_amount_eur: "0",
    },
  });
  const addTx = useAddTransaction();

  const onSubmit = async (values: FormValues) => {
    const amountCents = Math.round(parseFloat(values.amount_eur) * 100);
    const vatCents = Math.round(parseFloat(values.vat_amount_eur || "0") * 100);
    try {
      await addTx.mutateAsync({
        source: values.source,
        source_id: null,
        type: values.type,
        category: values.category || null,
        amount_cents: amountCents,
        currency: "EUR",
        amount_eur_cents: amountCents,
        stripe_fee_cents: 0,
        net_cents: amountCents,
        transaction_date: values.transaction_date,
        description: values.description || null,
        counterparty_name: values.counterparty_name || null,
        counterparty_email: null,
        counterparty_country: values.counterparty_country || null,
        counterparty_vat_number: null,
        vat_treatment: values.vat_treatment || null,
        vat_amount_cents: vatCents,
        notes: values.notes || null,
        raw_data: null,
      });
      toast.success("Transaction added");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error("Failed to add transaction");
    }
  };

  const type = watch("type");
  const vatTreatment = watch("vat_treatment");

  const handleVatAutoCalc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const amount = parseFloat(e.target.value);
    if (!isNaN(amount) && vatTreatment === "standard_23") {
      setValue("vat_amount_eur", ((amount / 1.23) * 0.23).toFixed(2));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Transaction</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" {...register("transaction_date", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select defaultValue="manual" onValueChange={v => setValue("source", v as "manual")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="revolut">Revolut</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select defaultValue="expense" onValueChange={v => setValue("type", v as "income")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="fee">Fee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select onValueChange={v => setValue("category", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input {...register("description")} placeholder="e.g. Vercel hosting Jan 2026" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Vendor / Customer</Label>
              <Input {...register("counterparty_name")} placeholder="Company or person" />
            </div>
            <div className="space-y-1.5">
              <Label>Country (ISO)</Label>
              <Input {...register("counterparty_country")} placeholder="IE, US, DE…" maxLength={2} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Amount (EUR incl. VAT)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("amount_eur", { required: true })}
                onChange={handleVatAutoCalc}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>VAT Treatment</Label>
              <Select defaultValue="outside_scope" onValueChange={v => setValue("vat_treatment", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard_23">23% IE Standard</SelectItem>
                  <SelectItem value="reduced_135">13.5% IE Reduced</SelectItem>
                  <SelectItem value="zero_rated">0% Zero-rated</SelectItem>
                  <SelectItem value="exempt">Exempt</SelectItem>
                  <SelectItem value="reverse_charge">Reverse Charge (EU B2B)</SelectItem>
                  <SelectItem value="outside_scope">Outside Scope</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>VAT Amount (EUR)</Label>
            <Input type="number" step="0.01" min="0" {...register("vat_amount_eur")} placeholder="0.00" />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea {...register("notes")} placeholder="Any additional notes for your accountant…" rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={addTx.isPending}>
              {addTx.isPending ? "Saving…" : "Save Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
