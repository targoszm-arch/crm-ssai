import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LinkedInMessage } from "./useLinkedInMessages";
import { searchTokens } from "@/lib/searchTokens";

// Why this exists, and why it is not just useLinkedInMessages with a search box.
//
// LinkedIn conversation history lives in TWO places and always has:
//
//   linkedin_messages  ~600 rows   full message_text, synced by the browser extension
//   activities         ~24,400 rows  activity_type like 'linkedin%', source 'meetalfred',
//                                    every one of them attached to a contact, with the
//                                    reply text in metadata.message_preview
//
// Searching only the first found ~2% of the replies and silently reported "no results"
// for the rest, which is what made LinkedIn feel unsearchable next to email. This hook
// searches both and returns one list ordered by time.
//
// The Meet Alfred side is a preview, not the whole thread: metadata.message_preview is
// truncated by the sync at ~200 characters. A word past that cutoff genuinely is not in
// the CRM, so it cannot be found here — that is a sync limit, not a search bug.

export type LinkedInFeedItem =
  | { kind: "message"; id: string; occurredAt: string; message: LinkedInMessage }
  | {
      kind: "activity";
      id: string;
      occurredAt: string;
      activityType: string;
      text: string;
      campaign: string | null;
      contactId: string | null;
      contactName: string | null;
    };

interface UseLinkedInFeedOptions {
  search?: string;
  linkedOnly?: boolean;
  limit?: number;
}

export function useLinkedInFeed(options: UseLinkedInFeedOptions = {}) {
  const { search, linkedOnly = false, limit = 100 } = options;

  return useQuery({
    queryKey: ["linkedin-feed", search ?? null, linkedOnly, limit],
    queryFn: async (): Promise<LinkedInFeedItem[]> => {
      // Every word has to match somewhere (chained .or()/.ilike() calls are AND'd
      // by PostgREST) — a single ilike.%term% treated a two-word name as one
      // literal substring, which only matched if it happened to appear in that
      // exact order and spacing. searchTokens also escapes ilike's own wildcards
      // (LinkedIn text is full of underscores) and strips filter-syntax characters.
      const tokens = search ? searchTokens(search) : [];

      let messageQuery = supabase
        .from("linkedin_messages")
        .select(
          `*, connection:linkedin_connections(
            id, name, headline, profile_url, contact_id,
            contacts(id, first_name, last_name)
          )`
        )
        .order("message_timestamp", { ascending: false })
        .limit(limit);

      let activityQuery = supabase
        .from("activities")
        .select(
          `id, activity_type, description, metadata, occurred_at, created_at, contact_id,
           contacts(id, first_name, last_name)`
        )
        .like("activity_type", "linkedin%")
        .order("occurred_at", { ascending: false })
        .limit(limit);

      for (const token of tokens) {
        // Searching the body alone missed every "what did X say" lookup, where X is
        // the person, not a word in the message.
        messageQuery = messageQuery.or(
          `message_text.ilike.%${token}%,sender_name.ilike.%${token}%,company_name.ilike.%${token}%`
        );
        activityQuery = activityQuery.ilike("description", `%${token}%`);
      }

      const [messagesRes, activitiesRes] = await Promise.all([
        messageQuery,
        activityQuery,
      ]);

      if (messagesRes.error) throw messagesRes.error;
      if (activitiesRes.error) throw activitiesRes.error;

      const messages = (messagesRes.data as LinkedInMessage[]) ?? [];
      const activities = activitiesRes.data ?? [];

      const items: LinkedInFeedItem[] = [];

      for (const message of messages) {
        if (linkedOnly && message.connection?.contact_id == null) continue;
        items.push({
          kind: "message",
          id: `message:${message.id}`,
          occurredAt: message.message_timestamp,
          message,
        });
      }

      for (const activity of activities) {
        const metadata = (activity.metadata ?? {}) as Record<string, unknown>;
        const preview =
          typeof metadata.message_preview === "string"
            ? metadata.message_preview
            : activity.description ?? "";
        const contact = activity.contacts as
          | { id: string; first_name: string; last_name: string | null }
          | null;
        if (linkedOnly && !activity.contact_id) continue;
        items.push({
          kind: "activity",
          id: `activity:${activity.id}`,
          occurredAt: activity.occurred_at ?? activity.created_at,
          activityType: activity.activity_type,
          text: preview,
          campaign:
            typeof metadata.campaign === "string" ? metadata.campaign : null,
          contactId: activity.contact_id,
          contactName: contact
            ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
            : null,
        });
      }

      items.sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );

      return items.slice(0, limit);
    },
  });
}
