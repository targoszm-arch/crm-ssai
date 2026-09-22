/**
 * The one industry list for the whole app. Deals and companies used to run
 * two different option sets (deals: lowercase slugs like "consulting";
 * companies: free text with 24 distinct real values, from "AI / talent
 * marketplace" to "Venture / D2C retail consultancy") that never lined up --
 * "unify this with People" (Magda, 22 Sep 2026). Values are stored as the
 * human-readable label itself, matching how companies.industry already held
 * text, not a slug needing translation back to a label.
 */
export const INDUSTRY_OPTIONS = [
  "Technology",
  "Healthcare",
  "Finance",
  "Manufacturing",
  "Retail",
  "Education",
  "Professional Services",
  "Pharmaceutical",
  "Other",
] as const;

export type Industry = (typeof INDUSTRY_OPTIONS)[number];
