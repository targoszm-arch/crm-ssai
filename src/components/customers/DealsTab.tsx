import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { DollarSign, Loader2, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DealsTabProps {
  contactId: string;
}

export function DealsTab({ contactId }: DealsTabProps) {
  const { data: deals, isLoading } = useQuery({
    queryKey: ["contact-deals", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!contactId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!deals || deals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No deals yet</p>
        <p className="text-xs mt-1">Deals associated with this contact will appear here</p>
      </div>
    );
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStageColor = (stage: string | null) => {
    switch (stage?.toLowerCase()) {
      case "won":
      case "closed won":
        return "bg-green-500 text-white";
      case "lost":
      case "closed lost":
        return "bg-red-500 text-white";
      case "negotiation":
        return "bg-yellow-500 text-white";
      case "proposal":
        return "bg-blue-500 text-white";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-3">
      {deals.map((deal) => (
        <div key={deal.id} className="p-4 rounded-lg border bg-card space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{deal.deal_name}</p>
              {deal.expected_close_date && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Expected close: {format(new Date(deal.expected_close_date), "MMM dd, yyyy")}
                </p>
              )}
            </div>
            <Badge className={`text-xs shrink-0 ${getStageColor(deal.stage)}`}>
              {deal.stage || "New"}
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-sm font-semibold">{formatCurrency(deal.deal_value)}</span>
            </div>
            {deal.probability !== null && (
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-sm">{deal.probability}% probability</span>
              </div>
            )}
          </div>

          {deal.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2">{deal.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}
