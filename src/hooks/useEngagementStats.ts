import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live counts for a contact's engagement stats, replacing the stale
 * contacts.done_activities / contacts.email_messages_count columns -- those
 * are a one-time snapshot written by the CSV import (import-contacts) and
 * never touched again, so they read 0 for anyone whose real activity
 * happened afterward inside the CRM (emails synced, LinkedIn replies,
 * notes) while the actual activities/emails tables had real rows all along.
 */
export function useEngagementStats(contactId: string | undefined) {
  return useQuery({
    queryKey: ["engagement-stats", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const [activities, emails] = await Promise.all([
        supabase.from("activities").select("id", { count: "exact", head: true }).eq("contact_id", contactId!),
        supabase.from("emails").select("id", { count: "exact", head: true }).eq("contact_id", contactId!),
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
