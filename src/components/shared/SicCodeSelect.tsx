import { AsyncCodeSelect } from "./AsyncCodeSelect";

interface SicCodeSelectProps {
  code?: string | null;
  title?: string | null;
  onChange: (code: string, title: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/** SEC's SIC code list — 443 code/title rows in sic_codes, searched server-side. A separate
 * classification from NAICS on purpose — SEC still keys off SIC, and the two systems don't map
 * one-to-one, so this is its own picker rather than a second column on the NAICS one. */
export function SicCodeSelect({ code, title, onChange, disabled, className, id }: SicCodeSelectProps) {
  return (
    <AsyncCodeSelect
      id={id}
      table="sic_codes"
      codeColumn="code"
      labelColumn="title"
      code={code}
      label={title}
      onChange={onChange}
      placeholder="Select SIC code..."
      searchPlaceholder="Search SIC by code or name..."
      emptyText="No SIC code found."
      disabled={disabled}
      className={className}
    />
  );
}
