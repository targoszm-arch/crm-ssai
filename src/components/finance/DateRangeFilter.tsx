import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A date filter, in the row where the other filters are.
 *
 * The year multi-select lives in the page header and scopes the report. That
 * is a different thing from "show me the transactions between these two
 * dates", which is what you want while looking at the table, and putting the
 * only date control somewhere else made the toolbar look like it had none.
 *
 * Presets are the periods this business actually works in — a VAT3 is
 * bi-monthly, so "This VAT period" is one click rather than two date entries
 * and a mental calculation of which two months are current.
 */

export interface DateRange {
  from: string | null;   // inclusive, YYYY-MM-DD
  to: string | null;     // inclusive
}

export const EMPTY_RANGE: DateRange = { from: null, to: null };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The bi-monthly VAT3 period containing `d`: Jan–Feb, Mar–Apr, and so on. */
export function vatPeriodOf(d: Date): DateRange {
  const start = Math.floor(d.getMonth() / 2) * 2;      // 0, 2, 4, …
  const from = new Date(Date.UTC(d.getFullYear(), start, 1));
  const to = new Date(Date.UTC(d.getFullYear(), start + 2, 0));
  return { from: iso(from), to: iso(to) };
}

function shiftPeriods(r: DateRange, by: number): DateRange {
  if (!r.from) return r;
  const d = new Date(r.from + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + by * 2);
  return vatPeriodOf(d);
}

function monthOf(d: Date, offset = 0): DateRange {
  const from = new Date(Date.UTC(d.getFullYear(), d.getMonth() + offset, 1));
  const to = new Date(Date.UTC(d.getFullYear(), d.getMonth() + offset + 1, 0));
  return { from: iso(from), to: iso(to) };
}

function yearOf(d: Date, offset = 0): DateRange {
  const y = d.getFullYear() + offset;
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

/** Does a transaction date fall inside the range? An open end is unbounded. */
export function inRange(date: string, r: DateRange): boolean {
  if (r.from && date < r.from) return false;
  if (r.to && date > r.to) return false;
  return true;
}

const fmt = (s: string) =>
  new Date(s + "T00:00:00Z").toLocaleDateString("en-IE", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });

export function rangeLabel(r: DateRange): string {
  if (!r.from && !r.to) return "All dates";
  if (r.from && !r.to) return `From ${fmt(r.from)}`;
  if (!r.from && r.to) return `Until ${fmt(r.to)}`;
  return `${fmt(r.from!)} – ${fmt(r.to!)}`;
}

export function DateRangeFilter({
  value, onChange, className,
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const active = !!(value.from || value.to);

  const presets: { label: string; range: DateRange }[] = [
    { label: "All dates", range: EMPTY_RANGE },
    { label: "This month", range: monthOf(today) },
    { label: "Last month", range: monthOf(today, -1) },
    { label: "This VAT period", range: vatPeriodOf(today) },
    { label: "Last VAT period", range: shiftPeriods(vatPeriodOf(today), -1) },
    { label: "This year", range: yearOf(today) },
    { label: "Last year", range: yearOf(today, -1) },
  ];

  const apply = (r: DateRange) => { onChange(r); setOpen(false); };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("h-10 justify-between gap-2 font-normal", active ? "w-auto" : "w-36")}
          >
            <span className="flex min-w-0 items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 opacity-50" />
              <span className="truncate">{rangeLabel(value)}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <div className="grid grid-cols-2 gap-1">
            {presets.map(p => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                className="justify-start font-normal"
                onClick={() => apply(p.range)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <Separator className="my-2" />

          {/* Custom range. Either end may be left blank — "everything before
              31 March" is a question people actually ask. */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Custom range</p>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="From date"
                value={value.from ?? ""}
                onChange={e => onChange({ ...value, from: e.target.value || null })}
                className="h-9"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                aria-label="To date"
                value={value.to ?? ""}
                onChange={e => onChange({ ...value, to: e.target.value || null })}
                className="h-9"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {active && (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-8 shrink-0 text-muted-foreground"
          aria-label="Clear date filter"
          onClick={() => onChange(EMPTY_RANGE)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
