import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { centsToEur } from "@/components/finance/financeUtils";

/**
 * Approve or decline each suspected duplicate, one at a time.
 *
 * Nothing here decides for her. The matching rule (same day, same amount,
 * same counterparty) is a good filter and a bad judge — two genuine identical
 * payments on one day are indistinguishable from a double-import in every
 * field a bank records. So the dialog lists the candidate next to what it
 * matches and asks; the default is the non-destructive answer, and the
 * footer always says exactly what Apply will do.
 */

export interface DuplicateReviewRow {
  date: string;
  who: string;
  amountCents: number;
  currency: string;
  type: string;
  /** Where the row came from, or when it was stored — context for deciding. */
  note?: string;
}

export interface DuplicateReviewItem {
  key: string;
  candidate: DuplicateReviewRow;
  matches: DuplicateReviewRow[];
  /**
   * True when the two rows carry the same provider transaction id, which is
   * proof rather than a guess — a bank does not issue one id twice.
   */
  certain?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  items: DuplicateReviewItem[];
  /** Wording for the two answers, e.g. ["Add", "Skip"] or ["Keep", "Delete"]. */
  approveLabel: string;
  declineLabel: string;
  /** The answer that changes nothing. Pre-selected for every item. */
  defaultDecision: "approve" | "decline";
  busy?: boolean;
  /** Called with the keys the person declined. */
  onConfirm: (declined: Set<string>) => void;
}

function RowLine({ row, muted }: { row: DuplicateReviewRow; muted?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm", muted && "text-muted-foreground")}>
      <span className="whitespace-nowrap tabular-nums">{row.date}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{row.who}</span>
      <span className="whitespace-nowrap tabular-nums">
        {row.currency === "EUR" ? centsToEur(row.amountCents) : `${(row.amountCents / 100).toFixed(2)} ${row.currency}`}
      </span>
      <span className="text-xs capitalize text-muted-foreground">{row.type}</span>
      {row.note && <span className="w-full text-xs text-muted-foreground">{row.note}</span>}
    </div>
  );
}

export function DuplicateReviewDialog({
  open, onOpenChange, title, description, items,
  approveLabel, declineLabel, defaultDecision, busy, onConfirm,
}: Props) {
  const [decisions, setDecisions] = useState<Record<string, "approve" | "decline">>({});

  // Reset every time the dialog opens, so a previous review cannot leak an
  // answer onto a row that merely reuses its key.
  useEffect(() => {
    if (open) setDecisions(Object.fromEntries(items.map(i => [i.key, defaultDecision])));
  }, [open, items, defaultDecision]);

  const declined = useMemo(
    () => new Set(items.filter(i => (decisions[i.key] ?? defaultDecision) === "decline").map(i => i.key)),
    [items, decisions, defaultDecision],
  );
  const approvedCount = items.length - declined.size;

  const setAll = (d: "approve" | "decline") =>
    setDecisions(Object.fromEntries(items.map(i => [i.key, d])));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Tall dialogs need a cap and a scrolling body — see CLAUDE.md. */}
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary">{items.length} to review</Badge>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAll("approve")}>
              {approveLabel} all
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAll("decline")}>
              {declineLabel} all
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-auto rounded-md border p-2">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nothing looks duplicated.
            </p>
          ) : items.map(item => {
            const decision = decisions[item.key] ?? defaultDecision;
            return (
              <div
                key={item.key}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3",
                  decision === "decline" && "bg-muted/40",
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <RowLine row={item.candidate} />
                  {item.matches.map((m, i) => (
                    <div key={i} className="border-l-2 pl-3">
                      <RowLine row={m} muted />
                    </div>
                  ))}
                  {item.certain && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      Same transaction id — certainly the same payment
                    </Badge>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant={decision === "approve" ? "default" : "outline"}
                    onClick={() => setDecisions(d => ({ ...d, [item.key]: "approve" }))}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    {approveLabel}
                  </Button>
                  <Button
                    size="sm"
                    variant={decision === "decline" ? "destructive" : "outline"}
                    onClick={() => setDecisions(d => ({ ...d, [item.key]: "decline" }))}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    {declineLabel}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="shrink-0">
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {approvedCount} to {approveLabel.toLowerCase()} · {declined.size} to {declineLabel.toLowerCase()}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(declined)} disabled={busy}>
            {busy ? "Working…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
