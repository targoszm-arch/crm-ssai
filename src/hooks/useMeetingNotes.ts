import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MeetingNote {
  id: string;
  contact_id: string | null;
  company_id: string | null;
  fireflies_meeting_id: string | null;
  title: string;
  meeting_date: string;
  duration_minutes: number | null;
  participants: string[];
  overview: string | null;
  action_items: Array<{ text: string; assignee?: string; timestamp?: string }>;
  summary: string | null;
  bullet_gist: string | null;
  transcript_url: string | null;
  audio_url: string | null;
  meeting_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingNotesScope {
  contactId?: string | null;
  companyId?: string | null;
}

export function useMeetingNotes(scope: MeetingNotesScope) {
  const { contactId, companyId } = scope;
  return useQuery({
    queryKey: ["meeting-notes", contactId, companyId],
    queryFn: async () => {
      let query = supabase.from("meeting_notes").select("*");
      query = contactId ? query.eq("contact_id", contactId) : query.eq("company_id", companyId!);
      const { data, error } = await query.order("meeting_date", { ascending: false });

      if (error) throw error;

      // Type assertion since the table is new and types may not be generated yet
      return (data || []) as unknown as MeetingNote[];
    },
    enabled: !!contactId || !!companyId,
  });
}

export function useAllMeetingNotes() {
  return useQuery({
    queryKey: ["meeting-notes-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_notes")
        .select("*, contacts(first_name, last_name, email)")
        .order("meeting_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as unknown as (MeetingNote & { contacts: { first_name: string; last_name: string | null; email: string | null } | null })[];
    },
  });
}
