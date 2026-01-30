import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Mail, ArrowUpRight, ArrowDownLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EmailsTabProps {
  contactId: string;
}

export function EmailsTab({ contactId }: EmailsTabProps) {
  const { data: emails, isLoading } = useQuery({
    queryKey: ["contact-emails", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emails")
        .select("*")
        .eq("contact_id", contactId)
        .order("received_at", { ascending: false })
        .limit(30);
      
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

  if (!emails || emails.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No emails yet</p>
        <p className="text-xs mt-1">Connect your email to see conversations with this contact</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {emails.map((email) => (
        <div key={email.id} className="p-3 rounded-lg border bg-card space-y-2">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {email.direction === "outbound" ? (
                <ArrowUpRight className="h-4 w-4 text-blue-500" />
              ) : (
                <ArrowDownLeft className="h-4 w-4 text-green-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{email.subject || "(No subject)"}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted-foreground">
                  {email.direction === "outbound" ? "To:" : "From:"} {email.from_name || email.from_email}
                </p>
                <span className="text-xs text-muted-foreground">•</span>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(email.received_at), "MMM dd, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
            {!email.is_read && (
              <Badge variant="default" className="text-xs shrink-0">New</Badge>
            )}
          </div>
          {email.snippet && (
            <p className="text-xs text-muted-foreground line-clamp-2 pl-7">
              {email.snippet}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
