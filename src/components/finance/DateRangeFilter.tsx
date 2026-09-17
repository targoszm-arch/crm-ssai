import { useState } from "react";
import { DateRange as DayPickerRange } from "react-day-picker";
import { format, startOfMonth, endOfMonth, addMonths, startOfYear, endOfYear } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DateRange, EMPTY_RANGE, isoDate as iso, toLocalDate as toDate, vatPeriodOf, rangeLabel,
} from "@/components/finance/financeUtils";

/**
 * A date filter, in the row where the other filters are.
 *
 * Built on the `Calendar` the repo already ships — shadcn's react-day-picker,
 * which until now was used in exactly one place. The first version of this
 * component hand-rolled two native `<input type="date">` boxes instead, which
 * rendered as browser-default "dd/mm/yyyy" fields that matched nothing else on
 * the page. There is no reason to hand-roll a date picker in a project that
 * already has one.
 *
 * Presets sit beside the calendar because they are how this business actually
 * selects time — a VAT3 is bi-monthly, so "This VAT period" is one click
 * rather than working out which two months are current and entering both.
 */

function presetsFor(today: Date): { label: string; range: DateRange }[] {
  const thisPeriod = vatPeriodOf(today);
  const lastPeriod = vatPeriodOf(addMonths(new Date(thisPeriod.from! + "T00:00:00"), -2));
  return [
    { label: "All dates", range: EMPTY_RANGE },
    { label: "This month", range: { from: iso(startOfMonth(today)), to: iso(endOfMonth(today)) } },
    { label: "Last month", range: {
      from: iso(startOfMonth(addMonths(today, -1))),
      to: iso(endOfMonth(addMonths(today, -1))),
    } },
    { label: "This VAT period", range: thisPeriod },
    { label: "Last VAT period", range: lastPeriod },
    { label: "This year", range: { from: iso(startOfYear(today)), to: iso(endOfYear(today)) } },
    { label: "Last year", range: {
      from: iso(startOfYear(addMonths(today, -12))),
      to: iso(endOfYear(addMonths(today, -12))),
    } },
  ];
}

const sameRange = (a: DateRange, b: DateRange) => a.from === b.from && a.to === b.to;

export function DateRangeFilter({
  value, onChange, className,
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const presets = presetsFor(today);
  const active = !!(value.from || value.to);

  const selected: DayPickerRange | undefined = value.from || value.to
    ? { from: toDate(value.from), to: toDate(value.to) }
    : undefined;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("h-10 justify-between gap-2 font-normal", active ? "w-auto" : "w-36")}
          >
            <span className="flex min-w-0 items-center gap-2">
              <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" />
              <span className="truncate">{rangeLabel(value)}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="flex w-auto p-0">
          {/* Presets read top to bottom in one column — the two-column grid
              this replaced put "Last month" under "All dates" and "This VAT
              period" beside it, so the reading order made no sense. */}
          <div className="flex w-44 shrink-0 flex-col gap-0.5 p-2">
            {presets.map(p => (
              <Button
                key={p.label}
                variant={sameRange(value, p.range) ? "secondary" : "ghost"}
                size="sm"
                className="justify-start font-normal"
                onClick={() => { onChange(p.range); setOpen(false); }}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <Separator orientation="vertical" className="h-auto" />

          <Calendar
            mode="range"
            numberOfMonths={2}
            defaultMonth={toDate(value.from) ?? addMonths(today, -1)}
            selected={selected}
            onSelect={(r: DayPickerRange | undefined) => onChange({
              from: r?.from ? iso(r.from) : null,
              to: r?.to ? iso(r.to) : null,
            })}
            weekStartsOn={1}
          />
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
