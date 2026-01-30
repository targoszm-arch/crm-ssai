import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Activity {
  id: string;
  contact_id: string | null;
  company_id: string | null;
  activity_type: string;
  description: string | null;
  source: string | null;
  source_id: string | null;
  metadata: Record<string, any> | null;
  occurred_at: string;
  created_at: string;
}

export function useActivities(contactId?: string, companyId?: string) {
  return useQuery({
    queryKey: ["activities", contactId, companyId],
    queryFn: async () => {
      let query = supabase
        .from("activities")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(50);

      if (contactId) {
        query = query.eq("contact_id", contactId);
      }

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching activities:", error);
        throw error;
      }

      return data as Activity[];
    },
    enabled: !!contactId || !!companyId,
  });
}

export function useRecentActivities(limit = 20) {
  return useQuery({
    queryKey: ["recent-activities", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select(`
          *,
          contacts (
            id,
            first_name,
            last_name,
            email
          ),
          companies (
            id,
            company_name
          )
        `)
        .order("occurred_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error fetching recent activities:", error);
        throw error;
      }

      return data;
    },
  });
}

export function getActivityIcon(activityType: string): string {
  const icons: Record<string, string> = {
    linkedin_reply: "💬",
    linkedin_connection: "🔗",
    linkedin_lead: "🎯",
    email_sent: "📤",
    email_received: "📥",
    email_opened: "👁️",
    email_clicked: "🖱️",
    meeting: "📅",
    call: "📞",
    note: "📝",
  };
  return icons[activityType] || "📌";
}

export function getActivityLabel(activityType: string): string {
  const labels: Record<string, string> = {
    linkedin_reply: "LinkedIn Reply",
    linkedin_connection: "LinkedIn Connection",
    linkedin_lead: "New Lead",
    email_sent: "Email Sent",
    email_received: "Email Received",
    email_opened: "Email Opened",
    email_clicked: "Email Clicked",
    meeting: "Meeting",
    call: "Phone Call",
    note: "Note Added",
  };
  return labels[activityType] || activityType;
}
