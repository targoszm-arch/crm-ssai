import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CalendarRange, ChevronDown } from "lucide-react";

/**
 * Year filter — multi-select.
 *
 * The previous control was a single-year dropdown, which is not a filter: it
 * decided what you were allowed to see one year at a time, so importing a
 * statement spanning a year boundary looked like an import that had silently
 * dropped half its rows. Years are checkboxes, any combination is valid, and
 * every year present in the data is offered rather than a hard-coded window.
 *
 * Selecting nothing means no constraint rather than an empty table — an
 * empty filter that hides everything is the same trap in a new shape.
 */
export function YearFilter({
  years, selected, onChange,
}: {
  /** Every year present in the data, with its row count. */
  years: { year: number; count: number }[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  const allSelected = years.length > 0 && years.every(y => selected.has(y.year));
  const activeCount = years
    .filter(y => selected.size === 0 || selected.has(y.year))
    .reduce((n, y) => n + y.count, 0);

  const toggle = (year: number) => {
    const next = new Set(selected);
    if (next.has(year)) next.delete(year);
    else next.add(year);
    onChange(next);
  };

  const label = selected.size === 0 || allSelected
    ? "All years"
    : [...selected].sort((a, b) => b - a).join(", ");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 justify-between gap-2 font-normal">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[16rem] truncate">{label}</span>
          <Badge variant="secondary" className="ml-1">{activeCount}</Badge>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-60 p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Years
          </span>
          <Button
            variant="ghost" size="sm" className="h-6 px-2 text-xs"
            onClick={() => onChange(allSelected ? new Set() : new Set(years.map(y => y.year)))}
          >
            {allSelected ? "Clear" : "Select all"}
          </Button>
        </div>

        {years.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-auto">
            {years.map(y => {
              const checked = selected.size === 0 || selected.has(y.year);
              return (
                <label
                  key={y.year}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => {
                      // An empty set means "everything", so the first click has
                      // to start from everything rather than from nothing —
                      // otherwise unticking one year would hide all the others.
                      if (selected.size === 0) {
                        const next = new Set(years.map(v => v.year));
                        next.delete(y.year);
                        onChange(next);
                      } else {
                        toggle(y.year);
                      }
                    }}
                  />
                  <span className="flex-1">{y.year}</span>
                  <span className="text-xs text-muted-foreground">{y.count}</span>
                </label>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
