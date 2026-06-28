export function centsToEur(cents: number): string {
  return (cents / 100).toLocaleString("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

export function centsToNum(cents: number): number {
  return cents / 100;
}

export const VAT_TREATMENT_LABELS: Record<string, string> = {
  standard_23: "23% IE",
  reduced_135: "13.5% IE",
  zero_rated: "0% Zero",
  exempt: "Exempt",
  reverse_charge: "Reverse Charge (EU B2B)",
  outside_scope: "Outside Scope",
};

export const VAT_TREATMENT_COLORS: Record<string, string> = {
  standard_23: "bg-blue-100 text-blue-800",
  reduced_135: "bg-cyan-100 text-cyan-800",
  zero_rated: "bg-gray-100 text-gray-700",
  exempt: "bg-gray-100 text-gray-700",
  reverse_charge: "bg-purple-100 text-purple-800",
  outside_scope: "bg-slate-100 text-slate-600",
};

export const SOURCE_COLORS: Record<string, string> = {
  stripe: "bg-violet-100 text-violet-800",
  revolut: "bg-sky-100 text-sky-800",
  paypal: "bg-blue-100 text-blue-800",
  manual: "bg-orange-100 text-orange-800",
};

export const TYPE_COLORS: Record<string, string> = {
  income: "text-emerald-600",
  expense: "text-red-600",
  refund: "text-amber-600",
  fee: "text-slate-500",
};

export const CATEGORIES = [
  { value: "saas_subscription", label: "SaaS Subscription" },
  { value: "consulting", label: "Consulting" },
  { value: "software", label: "Software / Tools" },
  { value: "equipment", label: "Equipment / Hardware" },
  { value: "marketing", label: "Marketing & Ads" },
  { value: "professional_services", label: "Professional Services" },
  { value: "travel", label: "Travel & Transport" },
  { value: "office", label: "Office & Admin" },
  { value: "bank_fees", label: "Bank Fees" },
  { value: "stripe_payout", label: "Stripe Payout" },
  { value: "other", label: "Other" },
];

// Irish VAT bi-monthly periods (VAT3 return)
export function getVatPeriods(year: number) {
  return [
    { label: "Jan–Feb", start: `${year}-01-01`, end: `${year}-02-28` },
    { label: "Mar–Apr", start: `${year}-03-01`, end: `${year}-04-30` },
    { label: "May–Jun", start: `${year}-05-01`, end: `${year}-06-30` },
    { label: "Jul–Aug", start: `${year}-07-01`, end: `${year}-08-31` },
    { label: "Sep–Oct", start: `${year}-09-01`, end: `${year}-10-31` },
    { label: "Nov–Dec", start: `${year}-11-01`, end: `${year}-12-31` },
  ];
}

export function exportToCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(r =>
      headers.map(h => {
        const v = r[h];
        const s = v == null ? "" : String(v);
        return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
