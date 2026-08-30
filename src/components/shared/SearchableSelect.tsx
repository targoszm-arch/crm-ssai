import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Extra text matched by the search box but shown dimmed, e.g. an email or company. */
  hint?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * A drop-in replacement for <Select> when the list is long enough that scrolling is not a
 * realistic way to find anything. The contact picker is backed by 5,801 rows and the company
 * picker by 1,217 — a plain Select renders every one of them with no way to filter.
 *
 * Command does the filtering client-side over the options passed in, matching both the label
 * and the hint, so "acme" finds a person by their company and "@gmail" finds them by email.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No match found.",
  disabled,
  className,
  id,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  // Command runs the filter once per option, so looking each one up with find() inside it
  // makes every keystroke O(n^2). At 5,801 contacts that is tens of millions of comparisons
  // per character typed. Index once instead.
  const byValue = useMemo(() => {
    const map = new Map<string, SearchableSelectOption>();
    for (const option of options) map.set(option.value, option);
    return map;
  }, [options]);

  const selected = byValue.get(value ?? "");

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            // itemValue is the option's value; match against the label and hint instead so
            // typing a name or an email finds the row rather than needing its uuid.
            const option = byValue.get(itemValue);
            if (!option) return 0;
            const haystack = `${option.label} ${option.hint ?? ""}`.toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(v) => {
                    // Deliberately NOT a toggle. Clicking the already-selected option used
                    // to emit "", which is forwarded straight to a uuid column and fails
                    // the insert with an invalid-uuid error rather than clearing anything.
                    onChange(v);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                  {option.hint && (
                    <span className="ml-2 truncate text-xs text-muted-foreground">
                      {option.hint}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
