import { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EnrichProvider } from "@/lib/api/enrichment";

/**
 * The source picker that sits behind every Enrich button.
 *
 * A menu rather than a settings toggle because the right source is a per-record decision,
 * not a preference: Apollo is the one to reach for on a LinkedIn-sourced contact with no
 * email, and there is no point spending an Apollo credit on a record you only want a
 * second opinion about. Choosing costs one extra click and "Best available" is first, so
 * the habitual path is unchanged for anyone who does not care.
 *
 * Every provider costs a credit somewhere, which is why the descriptions say what each
 * one actually spends rather than how good it is.
 */
const OPTIONS: Array<{ value: EnrichProvider; label: string; hint: string }> = [
  {
    value: "auto",
    label: "Best available",
    hint: "Apollo first, Hunter.io only if it misses",
  },
  {
    value: "apollo",
    label: "Apollo",
    hint: "Job title, seniority, phone, firmographics",
  },
  {
    value: "hunter",
    label: "Hunter.io",
    hint: "Email-led, best when you already have the address",
  },
];

interface EnrichProviderMenuProps {
  onEnrich: (provider: EnrichProvider) => void;
  disabled?: boolean;
  /** The button itself, so the caller keeps control of its size and variant. */
  children: ReactNode;
  align?: "start" | "end";
}

export function EnrichProviderMenu({
  onEnrich,
  disabled,
  children,
  align = "end",
}: EnrichProviderMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64">
        <DropdownMenuLabel>Enrich from</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onEnrich(option.value)}
            className="flex-col items-start gap-0.5"
          >
            <span className="font-medium">{option.label}</span>
            <span className="text-xs text-muted-foreground">{option.hint}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
