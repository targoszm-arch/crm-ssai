/** Real distinct values already in companies.stage (22 Sep 2026), kept as the
 * canonical picker rather than a free-text field a CSV import or a stray
 * keystroke can mismatch case/spelling on. */
export const SALES_STAGE_OPTIONS = [
  "Discovery",
  "Contact Made",
  "Cold Lead",
  "Warm Lead",
  "Hot Lead",
  "Marketing Qualified",
  "Sales Qualified",
  "Demo Done",
  "Prospect",
  "Partner",
] as const;

/** Same buckets `import-companies`'s createEmployeeRange() already computes
 * from a raw headcount, so a manually-picked value and an imported one never
 * disagree on the boundaries. */
export const COMPANY_SIZE_OPTIONS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
] as const;
