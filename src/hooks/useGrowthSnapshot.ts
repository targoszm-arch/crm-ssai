import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * The growth picture, assembled from the two systems that hold it.
 *
 * Revenue and email engagement come from this CRM's own tables. The trial
 * funnel comes from the LMS through `fetch-lms-funnel`, read live and never
 * stored — the system of record is LMS -> CRM -> Resend, one direction, and
 * a cached copy here would be a second source of truth competing with the
 * first.
 *
 * Peak Focus is deliberately absent. The CRM authors `stage` and `arr` and
 * pushes them there; reading them back is what let the two sides drift and
 * disagree on every shared client. Its ARR is this CRM's own deal data seen
 * through another window, so it is shown from the source instead.
 *
 * The two halves are separate queries on purpose. The LMS being unreachable
 * should grey out one card, not blank the page.
 */

export interface FunnelStage {
  stage: string;
  people: number;
  returned: number;
  created_a_course: number;
  had_video_failures: number;
}

export interface LmsFunnel {
  generated_at: string;
  totals: {
    people: number;
    paying: number;
    invoiced_cents: number;
    has_stripe_subscription: number;
    signed_up_last_7d: number;
  };
  stages: FunnelStage[];
  daily: Array<{
    snapshot_date: string;
    funnel_stage: string;
    people: number;
    has_paid_invoice: number;
    active_last_7d: number;
  }>;
  daily_days: number;
}

export interface CampaignRollup {
  campaign: string;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number;
}

export interface CrmGrowth {
  wonValue: number;
  openPipelineValue: number;
  openDeals: number;
  contacts: number;
  campaigns: CampaignRollup[];
  totalSent: number;
  totalOpened: number;
}

// Stages arrive as sortable keys (`2_no_course_created`). The prefix exists to
// order them and is not for reading.
const STAGE_LABELS: Record<string, string> = {
  "1_never_logged_in": "Never signed in",
  "2_no_course_created": "Signed in, no course",
  "3_created_course_gone_quiet": "Made a course, went quiet",
  "4_created_course_active": "Made a course, still active",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/^\d+_/, "").replace(/_/g, " ");
}

const CLOSED_WON = "Closed Won";
const CLOSED_LOST = "Closed Lost";

export function useLmsFunnel() {
  return useQuery({
    queryKey: ["lms-funnel"],
    queryFn: async (): Promise<LmsFunnel> => {
      const { data, error } = await supabase.functions.invoke("fetch-lms-funnel");
      if (error) throw error;
      return data as LmsFunnel;
    },
    // A live read-through across two projects. Refetching it on every window
    // focus would hammer the LMS for numbers that move a few times a day.
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useCrmGrowth() {
  return useQuery({
    queryKey: ["crm-growth"],
    queryFn: async (): Promise<CrmGrowth> => {
      const [dealsRes, contactsRes, emailsRes] = await Promise.all([
        supabase.from("deals").select("stage, deal_value"),
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase
          .from("sequence_emails")
          .select(
            "opened_at, clicked_at, bounced_at, sequence_enrollments!inner(sequences!inner(name))",
          )
          .not("sent_at", "is", null),
      ]);

      if (dealsRes.error) throw dealsRes.error;
      if (emailsRes.error) throw emailsRes.error;

      let wonValue = 0;
      let openPipelineValue = 0;
      let openDeals = 0;
      for (const d of dealsRes.data ?? []) {
        const value = Number(d.deal_value ?? 0);
        if (d.stage === CLOSED_WON) {
          wonValue += value;
        } else if (d.stage !== CLOSED_LOST) {
          openPipelineValue += value;
          openDeals++;
        }
      }

      const byCampaign = new Map<string, CampaignRollup>();
      for (const e of emailsRes.data ?? []) {
        const enrolment = e.sequence_enrollments as
          | { sequences?: { name?: string } | null }
          | null;
        const campaign = enrolment?.sequences?.name;
        if (!campaign) continue;
        const row = byCampaign.get(campaign) ?? {
          campaign,
          sent: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          openRate: 0,
        };
        row.sent++;
        if (e.opened_at) row.opened++;
        if (e.clicked_at) row.clicked++;
        if (e.bounced_at) row.bounced++;
        byCampaign.set(campaign, row);
      }

      // Against delivered, not sent: a bounce never had the chance to be
      // opened, so counting it in the denominator understates the copy.
      for (const row of byCampaign.values()) {
        const delivered = row.sent - row.bounced;
        row.openRate = delivered > 0 ? Math.round((row.opened / delivered) * 100) : 0;
      }

      const campaigns = [...byCampaign.values()].sort((a, b) => b.sent - a.sent);

      return {
        wonValue,
        openPipelineValue,
        openDeals,
        contacts: contactsRes.count ?? 0,
        campaigns,
        totalSent: campaigns.reduce((n, c) => n + c.sent, 0),
        totalOpened: campaigns.reduce((n, c) => n + c.opened, 0),
      };
    },
  });
}
