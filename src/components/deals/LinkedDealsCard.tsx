import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Link2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDeals, useUpdateDeal, type Deal } from "@/hooks/useDeals";
import { AddDealModal } from "./AddDealModal";

/**
 * The deals attached to one person or one company, with the two ways of
 * attaching one.
 *
 * The card this replaces showed the literal string "0" — not a count, a
 * hardcoded zero — and had no action at all, so a deal could only ever be tied
 * to someone from the deals board.
 *
 * Linking is an update, not a new row: the deal already exists, and creating a
 * second one so the person has something to point at is how a pipeline ends up
 * counting the same money twice.
 */

interface LinkedDealsCardProps {
  contactId?: string;
  companyId?: string | null;
  /** Prefills the new-deal form so the deal comes back to this record. */
  contactName?: string;
}

function money(value: number | null) {
  if (value == null) return null;
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function LinkedDealsCard({ contactId, companyId, contactName }: LinkedDealsCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const scope = contactId ? { contactId } : { companyId: companyId ?? undefined };
  const { data: linked, isLoading } = useDeals(scope);
  // Everything, so the picker can offer the deals that aren't attached yet.
  const { data: allDeals } = useDeals();
  const updateDeal = useUpdateDeal();

  const linkedIds = useMemo(
    () => new Set((linked ?? []).map((deal) => deal.id)),
    [linked],
  );
  const candidates = useMemo(
    () => (allDeals ?? []).filter((deal) => !linkedIds.has(deal.id)),
    [allDeals, linkedIds],
  );

  const link = (deal: Deal) => {
    updateDeal.mutate(
      contactId
        ? { id: deal.id, contact_id: contactId, ...(companyId ? { company_id: companyId } : {}) }
        : { id: deal.id, company_id: companyId! },
      {
        onSuccess: () => {
          toast.success(`${deal.deal_name} linked`);
          setPickerOpen(false);
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Linked deals</CardTitle>
        <div className="flex items-center gap-2">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                Link deal
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <Command>
                <CommandInput placeholder="Search deals…" />
                <CommandList>
                  <CommandEmpty>No deal to link.</CommandEmpty>
                  <CommandGroup>
                    {candidates.map((deal) => (
                      <CommandItem
                        key={deal.id}
                        value={`${deal.deal_name} ${deal.companies?.company_name ?? ""}`}
                        onSelect={() => link(deal)}
                        disabled={updateDeal.isPending}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm">{deal.deal_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[deal.companies?.company_name, deal.stage, money(deal.deal_value)]
                              .filter(Boolean)
                              .join(" · ") || "No details"}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New deal
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading deals…
          </div>
        ) : !linked?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No deals yet. Link an existing one, or start a new deal from here.
          </p>
        ) : (
          <div className="divide-y rounded-xl border">
            {linked.map((deal) => (
              <Link
                key={deal.id}
                to={`/deals?deal=${deal.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{deal.deal_name}</p>
                  {deal.companies?.company_name && (
                    <p className="truncate text-xs text-muted-foreground">
                      <Building2 className="mr-1 inline h-3 w-3" />
                      {deal.companies.company_name}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {money(deal.deal_value) && (
                    <span className="text-sm font-medium">{money(deal.deal_value)}</span>
                  )}
                  {deal.stage && <Badge variant="secondary">{deal.stage}</Badge>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>

      <AddDealModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialData={{
          ...(contactId ? { contact_id: contactId } : {}),
          ...(companyId ? { company_id: companyId } : {}),
          ...(contactName ? { deal_name: `${contactName} — new deal` } : {}),
        }}
      />
    </Card>
  );
}
