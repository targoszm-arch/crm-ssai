import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCodeSearch } from "@/hooks/useCodeSearch";

interface AsyncCodeSelectProps {
  table: "naics_codes" | "sic_codes";
  codeColumn: string;
  labelColumn: string;
  code?: string | null;
  label?: string | null;
  onChange: (code: string, label: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Shared base for NaicsCodeSelect and SicCodeSelect. Both search a reference table too large
 * to filter client-side (20,398 rows for NAICS, 443 for SIC) — the query hits Postgres on
 * every keystroke (debounced) rather than filtering a list already in memory, so it matches
 * by code number or by name either way, per the requirement that both be searchable by
 * number or by name, not just scrollable.
 */
export function AsyncCodeSelect({
  table,
  codeColumn,
  labelColumn,
  code,
  label,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search by code or name...",
  emptyText = "No match found.",
  disabled,
  className,
  id,
}: AsyncCodeSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { results, loading } = useCodeSearch({ table, codeColumn, labelColumn, query, enabled: open });

  const selectedText = code ? `${code} — ${label ?? ""}` : undefined;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !selectedText && "text-muted-foreground")}>
            {selectedText ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(28rem,var(--radix-popover-content-available-width))] min-w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        {/* shouldFilter=false: filtering happens server-side in useCodeSearch, so cmdk must
            not also filter the (already-filtered) results client-side against the raw query. */}
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...
              </div>
            )}
            {!loading && <CommandEmpty>{query.trim() ? emptyText : "Type a code or a name to search..."}</CommandEmpty>}
            <CommandGroup>
              {results.map((result) => (
                <CommandItem
                  key={result.code}
                  value={result.code}
                  onSelect={() => {
                    onChange(result.code, result.label);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4 shrink-0", code === result.code ? "opacity-100" : "opacity-0")}
                  />
                  <span className="mr-2 shrink-0 font-mono text-xs text-muted-foreground">{result.code}</span>
                  <span className="truncate">{result.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
