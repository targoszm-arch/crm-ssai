import { useMemo } from "react";
import { SearchableSelect } from "./SearchableSelect";
import { COUNTRIES, normalizeCountry } from "@/lib/constants/countries";

interface CountrySelectProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/** Thin wrapper over SearchableSelect rather than a second hand-rolled combobox --
 * same picker used for the company Country field and the contact Work Location
 * field, so both always resolve to the same canonical list. */
export function CountrySelect({ value, onChange, placeholder = "Select country...", disabled, className, id }: CountrySelectProps) {
  const options = useMemo(() => COUNTRIES.map((c) => ({ value: c, label: c })), []);
  const normalized = normalizeCountry(value);
  // A stored value that doesn't resolve to the canonical list (a stray old
  // free-text entry) still shows as itself rather than silently blanking out.
  const resolvedOptions = normalized && !COUNTRIES.includes(normalized as (typeof COUNTRIES)[number])
    ? [{ value: normalized, label: normalized }, ...options]
    : options;

  return (
    <SearchableSelect
      id={id}
      options={resolvedOptions}
      value={normalized ?? undefined}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Search countries..."
      emptyText="No country found."
      disabled={disabled}
      className={className}
    />
  );
}
