import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Newsletters are a local mirror of Content Lab sends, pulled from its public API.
 *
 * They are NOT sequences and their numbers do not line up with sequence analytics: a
 * sequence has a row per recipient in sequence_emails, so open and click rates are
 * computable, whereas a newsletter reports a recipient count and a status and nothing
 * per-person. That is why they get their own view rather than being forced into the
 * sequence charts, where the rates would have to be invented.
 */
export interface NewsletterSend {
  id: string;
  content_lab_article_id: string | null;
  subject_line: string | null;
  preview_text: string | null;
  audience_type: string | null;
  audience_id: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  status: string | null;
  recipient_count: number | null;
  error_message: string | null;
  synced_at: string;
}

export function useNewsletters() {
  return useQuery({
    queryKey: ["newsletter-sends"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_sends")
        .select("*")
        .order("sent_at", { ascending: false, nullsFirst: false })
        .order("scheduled_at", { ascending: false });

      if (error) throw error;
      return (data || []) as NewsletterSend[];
    },
  });
}

export interface NewsletterTotals {
  sent: number;
  scheduled: number;
  cancelled: number;
  failed: number;
  recipientsReached: number;
  lastSentAt: string | null;
}

export function useNewsletterTotals() {
  const { data, isLoading } = useNewsletters();

  const totals: NewsletterTotals = {
    sent: 0,
    scheduled: 0,
    cancelled: 0,
    failed: 0,
    // Only counts newsletters that actually went out. A cancelled send still carries the
    // audience size it would have reached, and adding those in would overstate reach —
    // the two cancelled 2,039-recipient rows would treble the number on their own.
    recipientsReached: 0,
    lastSentAt: null,
  };

  for (const n of data ?? []) {
    const status = (n.status ?? "").toLowerCase();
    if (status === "sent") {
      totals.sent++;
      totals.recipientsReached += n.recipient_count ?? 0;
      if (n.sent_at && (!totals.lastSentAt || n.sent_at > totals.lastSentAt)) {
        totals.lastSentAt = n.sent_at;
      }
    } else if (status === "scheduled" || status === "sending") {
      totals.scheduled++;
    } else if (status === "cancelled") {
      totals.cancelled++;
    } else if (status === "failed") {
      totals.failed++;
    }
  }

  return { totals, isLoading };
}
