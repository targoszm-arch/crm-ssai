import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EngagementStatsScope {
  contactId?: string | null;
  companyId?: string | null;
}

/**
 * Live counts for a contact's or company's engagement stats, replacing the stale
 * contacts.done_activities / contacts.email_messages_count / companies.done_activities /
 * companies.email_messages_count columns -- those are a one-time snapshot written by the
 * CSV import (import-contacts) and never touched again, so they read 0 for anyone whose
 * real activity happened afterward inside the CRM (emails synced, LinkedIn replies,
 * notes) while the actual activities/emails tables had real rows all along.
 */
export function useEngagementStats(scope: EngagementStatsScope) {
  const { contactId, companyId } = scope;
  return useQuery({
    queryKey: ["engagement-stats", contactId, companyId],
    enabled: !!contactId || !!companyId,
    queryFn: async () => {
      const column = contactId ? "contact_id" : "company_id";
      const value = contactId ?? companyId!;
      const [activities, emails] = await Promise.all([
        supabase.from("activities").select("id", { count: "exact", head: true }).eq(column, value),
        supabase.from("emails").select("id", { count: "exact", head: true }).eq(column, value),
      ]);
      if (activities.error) throw activities.error;
      if (emails.error) throw emails.error;
      return {
        completedActivities: activities.count ?? 0,
        emailMessages: emails.count ?? 0,
      };
    },
  });
}
