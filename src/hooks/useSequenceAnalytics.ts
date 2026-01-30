import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RecipientData {
  id: string;
  contactId: string;
  name: string;
  email: string;
  opens: number;
  clicks: number;
  lastOpened: string | null;
  lastClicked: string | null;
  status: "delivered" | "opened" | "clicked" | "bounced" | "unsubscribed" | "unopened";
  bounceType?: string;
}

export interface LinkStats {
  url: string;
  uniqueClicks: number;
  totalClicks: number;
  percentage: number;
}

export interface TimeSeriesData {
  time: string;
  opens: number;
  clicks: number;
}

export interface SequenceAnalytics {
  sequenceId: string;
  sequenceName: string;
  // Delivery metrics
  totalDelivered: number;
  totalBounced: number;
  hardBounces: number;
  softBounces: number;
  temporaryBounces: number;
  blockedBounces: number;
  totalUnsubscribed: number;
  totalSpamReports: number;
  // Engagement metrics
  uniqueOpens: number;
  totalOpens: number;
  uniqueClicks: number;
  totalClicks: number;
  openRate: number;
  clickRate: number;
  clickThroughRate: number;
  // Per-recipient data
  recipients: RecipientData[];
  // Time series data
  performanceOverTime: TimeSeriesData[];
  // Link performance
  linkStats: LinkStats[];
}

export function useSequenceAnalytics(sequenceId?: string) {
  return useQuery({
    queryKey: ["sequence-analytics", sequenceId],
    queryFn: async (): Promise<SequenceAnalytics | null> => {
      if (!sequenceId) return null;

      // Fetch sequence info
      const { data: sequence } = await supabase
        .from("sequences")
        .select("id, name")
        .eq("id", sequenceId)
        .single();

      if (!sequence) return null;

      // Fetch all sequence emails for this sequence
      const { data: emails } = await supabase
        .from("sequence_emails")
        .select(`
          id,
          enrollment_id,
          status,
          sent_at,
          opened_at,
          clicked_at,
          bounced_at,
          bounce_type,
          unsubscribed_at,
          spam_reported_at,
          unique_opens,
          total_opens,
          unique_clicks,
          total_clicks,
          subject,
          sequence_enrollments (
            id,
            contact_id,
            contacts (
              id,
              first_name,
              last_name,
              email
            )
          )
        `)
        .eq("sequence_enrollments.sequence_id", sequenceId)
        .not("sent_at", "is", null);

      // Fetch tracking events for time series
      const { data: trackingEvents } = await supabase
        .from("email_tracking_events")
        .select("event_type, occurred_at, link_url")
        .in("email_id", (emails || []).map(e => e.id))
        .order("occurred_at", { ascending: true });

      // Calculate metrics
      const deliveredEmails = (emails || []).filter(e => e.sent_at && !e.bounced_at);
      const bouncedEmails = (emails || []).filter(e => e.bounced_at);
      const openedEmails = (emails || []).filter(e => e.opened_at);
      const clickedEmails = (emails || []).filter(e => e.clicked_at);
      const unsubscribedEmails = (emails || []).filter(e => e.unsubscribed_at);
      const spamEmails = (emails || []).filter(e => e.spam_reported_at);

      // Bounce breakdown
      const hardBounces = bouncedEmails.filter(e => e.bounce_type === "hard").length;
      const softBounces = bouncedEmails.filter(e => e.bounce_type === "soft").length;
      const temporaryBounces = bouncedEmails.filter(e => e.bounce_type === "temporary").length;
      const blockedBounces = bouncedEmails.filter(e => e.bounce_type === "blocked").length;

      // Aggregate opens/clicks
      const totalOpens = (emails || []).reduce((sum, e) => sum + (e.total_opens || 0), 0);
      const uniqueOpens = openedEmails.length;
      const totalClicks = (emails || []).reduce((sum, e) => sum + (e.total_clicks || 0), 0);
      const uniqueClicks = clickedEmails.length;

      // Calculate rates
      const totalDelivered = deliveredEmails.length;
      const openRate = totalDelivered > 0 ? Math.round((uniqueOpens / totalDelivered) * 100) : 0;
      const clickRate = totalDelivered > 0 ? Math.round((uniqueClicks / totalDelivered) * 100) : 0;
      const clickThroughRate = uniqueOpens > 0 ? Math.round((uniqueClicks / uniqueOpens) * 100) : 0;

      // Build recipients data
      const recipientsMap = new Map<string, RecipientData>();
      for (const email of emails || []) {
        const enrollment = email.sequence_enrollments as any;
        const contact = enrollment?.contacts as any;
        if (!contact?.id) continue;

        const existing = recipientsMap.get(contact.id);
        const opens = (email.total_opens || 0) + (existing?.opens || 0);
        const clicks = (email.total_clicks || 0) + (existing?.clicks || 0);

        let status: RecipientData["status"] = "delivered";
        if (email.bounced_at) status = "bounced";
        else if (email.unsubscribed_at) status = "unsubscribed";
        else if (email.clicked_at) status = "clicked";
        else if (email.opened_at) status = "opened";
        else if (!email.opened_at) status = "unopened";

        recipientsMap.set(contact.id, {
          id: email.id,
          contactId: contact.id,
          name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unknown",
          email: contact.email || "",
          opens,
          clicks,
          lastOpened: email.opened_at || existing?.lastOpened || null,
          lastClicked: email.clicked_at || existing?.lastClicked || null,
          status,
          bounceType: email.bounce_type || undefined,
        });
      }

      // Build time series data (group by hour)
      const timeSeriesMap = new Map<string, { opens: number; clicks: number }>();
      for (const event of trackingEvents || []) {
        const hour = new Date(event.occurred_at).toISOString().slice(0, 13) + ":00";
        const existing = timeSeriesMap.get(hour) || { opens: 0, clicks: 0 };
        if (event.event_type === "open") existing.opens++;
        if (event.event_type === "click") existing.clicks++;
        timeSeriesMap.set(hour, existing);
      }
      const performanceOverTime = Array.from(timeSeriesMap.entries())
        .map(([time, data]) => ({ time, ...data }))
        .sort((a, b) => a.time.localeCompare(b.time));

      // Build link stats
      const linkMap = new Map<string, { unique: Set<string>; total: number }>();
      for (const event of trackingEvents || []) {
        if (event.event_type === "click" && event.link_url) {
          const existing = linkMap.get(event.link_url) || { unique: new Set(), total: 0 };
          existing.unique.add(event.occurred_at); // Use timestamp as unique identifier
          existing.total++;
          linkMap.set(event.link_url, existing);
        }
      }
      const linkStats: LinkStats[] = Array.from(linkMap.entries())
        .map(([url, data]) => ({
          url,
          uniqueClicks: data.unique.size,
          totalClicks: data.total,
          percentage: totalClicks > 0 ? Math.round((data.total / totalClicks) * 100) : 0,
        }))
        .sort((a, b) => b.uniqueClicks - a.uniqueClicks);

      return {
        sequenceId,
        sequenceName: sequence.name,
        totalDelivered,
        totalBounced: bouncedEmails.length,
        hardBounces,
        softBounces,
        temporaryBounces,
        blockedBounces,
        totalUnsubscribed: unsubscribedEmails.length,
        totalSpamReports: spamEmails.length,
        uniqueOpens,
        totalOpens,
        uniqueClicks,
        totalClicks,
        openRate,
        clickRate,
        clickThroughRate,
        recipients: Array.from(recipientsMap.values()),
        performanceOverTime,
        linkStats,
      };
    },
    enabled: !!sequenceId,
  });
}

export function useAllSequencesAnalytics() {
  return useQuery({
    queryKey: ["all-sequences-analytics"],
    queryFn: async () => {
      // Fetch all active sequences with email counts
      const { data: sequences } = await supabase
        .from("sequences")
        .select("id, name, status")
        .order("created_at", { ascending: false });

      // Fetch aggregate stats for all sequence emails
      const { data: emailStats } = await supabase
        .from("sequence_emails")
        .select(`
          id,
          sent_at,
          opened_at,
          clicked_at,
          bounced_at,
          total_opens,
          total_clicks
        `)
        .not("sent_at", "is", null);

      const totalSent = emailStats?.length || 0;
      const totalOpened = emailStats?.filter(e => e.opened_at).length || 0;
      const totalClicked = emailStats?.filter(e => e.clicked_at).length || 0;
      const totalBounced = emailStats?.filter(e => e.bounced_at).length || 0;
      const aggregateOpens = emailStats?.reduce((sum, e) => sum + (e.total_opens || 0), 0) || 0;
      const aggregateClicks = emailStats?.reduce((sum, e) => sum + (e.total_clicks || 0), 0) || 0;

      return {
        sequences: sequences || [],
        totalSent,
        totalOpened,
        totalClicked,
        totalBounced,
        aggregateOpens,
        aggregateClicks,
        openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
        clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
      };
    },
  });
}
