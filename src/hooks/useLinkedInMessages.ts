import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LinkedInMessage {
  id: string;
  sender_linkedin_id: string;
  recipient_linkedin_id: string;
  message_text: string;
  message_timestamp: string;
  is_read: boolean;
  connection_id: string | null;
  created_at: string;
  // Columns from Meet Alfred sync
  sender_name?: string | null;
  campaign_name?: string | null;
  profile_url?: string | null;
  raw_payload?: Record<string, unknown> | null;
  connection?: {
    id: string;
    name: string;
    headline: string | null;
    profile_url: string | null;
    contact_id: string | null;
    contacts?: {
      id: string;
      first_name: string;
      last_name: string | null;
    } | null;
  } | null;
}

interface UseLinkedInMessagesOptions {
  search?: string;
  linkedOnly?: boolean;
}

export function useLinkedInMessages(options: UseLinkedInMessagesOptions = {}) {
  return useQuery({
    queryKey: ["linkedin-messages", options],
    queryFn: async () => {
      let query = supabase
        .from("linkedin_messages")
        .select(`
          *,
          connection:linkedin_connections(
            id,
            name,
            headline,
            profile_url,
            contact_id,
            contacts(id, first_name, last_name)
          )
        `)
        .order("message_timestamp", { ascending: false })
        .limit(100);

      if (options.search) {
        query = query.ilike("message_text", `%${options.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      let messages = data as LinkedInMessage[];

      // Filter to only linked messages if requested
      if (options.linkedOnly) {
        messages = messages.filter(
          (msg) => msg.connection?.contact_id != null
        );
      }

      return messages;
    },
  });
}

export function useLinkedInConnections() {
  return useQuery({
    queryKey: ["linkedin-connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linkedin_connections")
        .select(`
          *,
          contacts(id, first_name, last_name, email)
        `)
        .order("name", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}
