import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";

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
  n26: "bg-teal-100 text-teal-800",
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

// ── Irish chart of accounts (FRS 102 / Irish GAAP) ─────────────────────────
//
// This is a *different axis* from `CATEGORIES` above and both are kept.
// `CATEGORIES` says what the spend was for in product terms ("SaaS
// subscription"); this says which line of the financial statements the amount
// posts to, which is what an accountant, Xero or Sage needs. The two diverge
// often enough to matter: a laptop is "Equipment" to us and a *fixed asset*
// to the accounts, and client dinners are an overhead that is specifically
// NOT deductible in Ireland, which is why "Entertainment – Disallowable" is
// its own line rather than being folded into Travel & Subsistence.
//
// The list is deliberately fixed. A chart of accounts that anyone can extend
// from a text box stops reconciling to anything, so the dropdown offers these
// and nothing else. Tax *rates* are the opposite — see FinanceTaxRate.

export interface AccountingCategoryGroup {
  group: string;
  statement: "pl" | "cogs" | "income" | "asset" | "liability";
  options: { value: string; label: string }[];
}

export const ACCOUNTING_CATEGORIES: AccountingCategoryGroup[] = [
  {
    group: "Expenses (P&L / Overheads)",
    statement: "pl",
    options: [
      { value: "advertising_marketing",   label: "Advertising & Marketing" },
      { value: "audit_accountancy",       label: "Audit & Accountancy Fees" },
      { value: "bank_fees",               label: "Bank Fees & Charges" },
      { value: "bank_revaluations",       label: "Bank Revaluations" },
      { value: "cleaning_waste",          label: "Cleaning & Waste Disposal" },
      { value: "computer_it_support",     label: "Computer & IT Support" },
      { value: "consultancy_fees",        label: "Consultancy Fees" },
      { value: "courier_freight",         label: "Courier & Freight" },
      { value: "entertainment_disallow",  label: "Entertainment – Disallowable" },
      { value: "general_sundry",          label: "General Expenses / Sundry" },
      { value: "insurance",               label: "Insurance" },
      { value: "legal_fees",              label: "Legal Fees" },
      { value: "light_heat_power",        label: "Light, Heat & Power" },
      { value: "motor_expenses",          label: "Motor Expenses" },
      { value: "printing_stationery",     label: "Printing & Stationery" },
      { value: "rent_rates",              label: "Rent & Rates" },
      { value: "repairs_maintenance",     label: "Repairs & Maintenance" },
      { value: "software_subscriptions",  label: "Software & Subscriptions" },
      { value: "staff_wages",             label: "Staff Wages & Salaries" },
      { value: "staff_training",          label: "Staff Training & Recruitment" },
      { value: "telephone_broadband",     label: "Telephone & Broadband" },
      { value: "travel_subsistence",      label: "Travel & Subsistence" },
    ],
  },
  {
    group: "Direct Costs (COGS)",
    statement: "cogs",
    options: [
      { value: "direct_contractor_fees",  label: "Direct Contractor Fees" },
      { value: "inventory_materials",     label: "Inventory / Material Purchases" },
      { value: "import_duties_carriage",  label: "Import Duties & Carriage" },
    ],
  },
  {
    group: "Revenue (Income)",
    statement: "income",
    options: [
      { value: "sales_income",            label: "Sales / Sales Income" },
      { value: "other_income",            label: "Other Income" },
      { value: "realised_currency_gains", label: "Realised Currency Gains" },
    ],
  },
  {
    group: "Assets (Balance Sheet)",
    statement: "asset",
    options: [
      { value: "accounts_receivable",     label: "Accounts Receivable (Debtors)" },
      { value: "bank_cash_accounts",      label: "Bank / Cash Accounts" },
      { value: "computer_equipment",      label: "Computer Equipment (Fixed Asset)" },
      { value: "office_equipment",        label: "Office Equipment (Fixed Asset)" },
      { value: "prepayments",             label: "Prepayments" },
    ],
  },
  {
    group: "Liabilities (Balance Sheet)",
    statement: "liability",
    options: [
      { value: "accounts_payable",        label: "Accounts Payable (Creditors)" },
      { value: "accruals",                label: "Accruals" },
      { value: "directors_loan",          label: "Director's Loan Account" },
      { value: "paye_prsi_usc",           label: "PAYE/PRSI/USC Liability" },
      { value: "vat_control",             label: "VAT Control Account" },
    ],
  },
];

export const ACCOUNTING_CATEGORY_LABELS: Record<string, string> =
  Object.fromEntries(
    ACCOUNTING_CATEGORIES.flatMap(g => g.options.map(o => [o.value, o.label]))
  );

/** Which statement group a posting code belongs to — drives the row colour. */
export const ACCOUNTING_CATEGORY_STATEMENT: Record<string, AccountingCategoryGroup["statement"]> =
  Object.fromEntries(
    ACCOUNTING_CATEGORIES.flatMap(g => g.options.map(o => [o.value, g.statement]))
  );

export const STATEMENT_COLORS: Record<AccountingCategoryGroup["statement"], string> = {
  pl:        "bg-amber-100 text-amber-800",
  cogs:      "bg-orange-100 text-orange-800",
  income:    "bg-emerald-100 text-emerald-800",
  asset:     "bg-sky-100 text-sky-800",
  liability: "bg-rose-100 text-rose-800",
};

/** Format a stored rate for the cell: "Tax on Sales (23%)". */
export function formatTaxRate(name: string | null, percent: number | null): string {
  if (!name) return "—";
  const pct = percent == null ? null : Number(percent);
  return pct == null ? name : `${name} (${pct % 1 === 0 ? pct.toFixed(0) : pct}%)`;
}

// ── Date ranges ────────────────────────────────────────────────────────────
// Used by the transactions date filter. They live here rather than in the
// component because they are pure functions about dates, and a component file
// that also exports helpers breaks fast refresh.

/** A filter range: ISO dates, either end optional. */
export interface DateRange {
  from: string | null;
  to: string | null;
}

export const EMPTY_RANGE: DateRange = { from: null, to: null };

export const isoDate = (d: Date): string => format(d, "yyyy-MM-dd");

/** Parses an ISO date as local midnight, so no timezone shifts the day. */
export const toLocalDate = (s: string | null): Date | undefined =>
  s ? new Date(s + "T00:00:00") : undefined;

/** The bi-monthly VAT3 period containing `d`: Jan-Feb, Mar-Apr, and so on. */
export function vatPeriodOf(d: Date): DateRange {
  const start = startOfMonth(addMonths(d, -(d.getMonth() % 2)));
  return { from: isoDate(start), to: isoDate(endOfMonth(addMonths(start, 1))) };
}

/** Does a transaction date fall inside the range? An open end is unbounded. */
export function inRange(date: string, r: DateRange): boolean {
  if (r.from && date < r.from) return false;
  if (r.to && date > r.to) return false;
  return true;
}

export function rangeLabel(r: DateRange): string {
  const f = (s: string) => format(new Date(s + "T00:00:00"), "d MMM yyyy");
  if (!r.from && !r.to) return "All dates";
  if (r.from && !r.to) return `From ${f(r.from)}`;
  if (!r.from && r.to) return `Until ${f(r.to)}`;
  return `${f(r.from)} - ${f(r.to)}`;
}
