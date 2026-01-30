import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Target, Loader2, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LeadsTabProps {
  contactId: string;
}

export function LeadsTab({ contactId }: LeadsTabProps) {
  const { data: leads, isLoading } = useQuery({
    queryKey: ["contact-leads", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
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

  if (!leads || leads.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No leads yet</p>
        <p className="text-xs mt-1">Leads associated with this contact will appear here</p>
      </div>
    );
  }

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "qualified":
        return "bg-green-500 text-white";
      case "disqualified":
        return "bg-red-500 text-white";
      case "contacted":
        return "bg-blue-500 text-white";
      case "new":
        return "bg-yellow-500 text-white";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-3">
      {leads.map((lead) => (
        <div key={lead.id} className="p-4 rounded-lg border bg-card space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {lead.contact_name || lead.company_name || "Unnamed Lead"}
              </p>
              {lead.source && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Source: {lead.source}
                </p>
              )}
            </div>
            <Badge className={`text-xs shrink-0 ${getStatusColor(lead.status)}`}>
              {lead.status || "New"}
            </Badge>
          </div>

          {lead.qualification_score !== null && (
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">Score: {lead.qualification_score}</span>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {lead.email && <span>{lead.email}</span>}
            {lead.phone && <span>{lead.phone}</span>}
          </div>

          {lead.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2">{lead.notes}</p>
          )}

          <p className="text-xs text-muted-foreground">
            Created: {format(new Date(lead.created_at), "MMM dd, yyyy")}
          </p>
        </div>
      ))}
    </div>
  );
}
