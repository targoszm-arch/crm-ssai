import { AsyncCodeSelect } from "./AsyncCodeSelect";

interface NaicsCodeSelectProps {
  code?: string | null;
  description?: string | null;
  onChange: (code: string, description: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/** NAICS 2022 Index — 20,398 code/description rows in naics_codes, searched server-side. */
export function NaicsCodeSelect({ code, description, onChange, disabled, className, id }: NaicsCodeSelectProps) {
  return (
    <AsyncCodeSelect
      id={id}
      table="naics_codes"
      codeColumn="code"
      labelColumn="description"
      code={code}
      label={description}
      onChange={onChange}
      placeholder="Select NAICS code..."
      searchPlaceholder="Search NAICS by code or name..."
      emptyText="No NAICS code found."
      disabled={disabled}
      className={className}
    />
  );
}
