import { useMemo } from "react";
import { Building2, Users, AlertTriangle, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Deal } from "@/hooks/useDeals";
import { LabelBadge, parseLabels } from "@/components/shared/LabelBadge";
import { formatDistanceToNow, differenceInDays } from "date-fns";

interface DealCardProps {
  deal: Deal;
  onClick?: () => void;
  isDragging?: boolean;
}

export function DealCard({ deal, onClick, isDragging }: DealCardProps) {
  const daysSinceCreation = useMemo(() => {
    return differenceInDays(new Date(), new Date(deal.created_at));
  }, [deal.created_at]);

  const timeDisplay = useMemo(() => {
    if (daysSinceCreation === 0) return "Today";
    return `${daysSinceCreation}d`;
  }, [daysSinceCreation]);

  const timeBadgeColor = useMemo(() => {
    if (daysSinceCreation <= 7) return "bg-emerald-100 text-emerald-700";
    if (daysSinceCreation <= 14) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  }, [daysSinceCreation]);

  const isStale = daysSinceCreation > 14;

  const labels = parseLabels(deal.labels);

  const formatValue = (value: number | null) => {
    if (!value) return null;
    if (value >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `€${(value / 1000).toFixed(0)}K`;
    return `€${value}`;
  };

  return (
    <Card
      className={cn(
        "p-3 cursor-pointer hover:shadow-md transition-shadow",
        isDragging && "opacity-50 rotate-2 shadow-lg"
      )}
      onClick={onClick}
      draggable
    >
      <div className="space-y-2">
        {/* Header with title and warning */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-2">
            {deal.deal_name}
          </h4>
          <div className="flex items-center gap-1 shrink-0">
            {isStale && (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", timeBadgeColor)}>
              {timeDisplay}
            </span>
          </div>
        </div>

        {/* Company */}
        {deal.companies && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span className="truncate">{deal.companies.company_name}</span>
          </div>
        )}

        {/* Value and details */}
        <div className="flex items-center gap-2 flex-wrap">
          {deal.deal_value && (
            <Badge variant="secondary" className="gap-1">
              <DollarSign className="h-3 w-3" />
              {formatValue(deal.deal_value)}
            </Badge>
          )}
          
          {deal.companies?.employee_count && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Users className="h-3 w-3" />
              {deal.companies.employee_count}
            </Badge>
          )}

          {deal.industry && (
            <Badge variant="outline" className="text-xs">
              {deal.industry}
            </Badge>
          )}
        </div>

        {/* Labels */}
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {labels.slice(0, 3).map((label, i) => (
              <LabelBadge
                key={i}
                label={label.label}
                colorIndex={label.colorIndex}
                size="sm"
              />
            ))}
            {labels.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{labels.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Contact info */}
        {deal.contacts && (
          <div className="flex items-center gap-2 pt-1 border-t">
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              {deal.contacts.first_name?.[0]?.toUpperCase()}
              {deal.contacts.last_name?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-muted-foreground truncate">
              {deal.contacts.first_name} {deal.contacts.last_name}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
