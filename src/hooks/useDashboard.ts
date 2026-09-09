import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Everything the dashboard shows, read from the CRM's own tables.
 *
 * It previously rendered `@/data/mockData` — an e-commerce template's revenue,
 * orders and cart-abandonment figures, none of which this product has. The
 * numbers were not stale, they were invented, and no amount of refreshing was
 * ever going to change them.
 *
 * Counts use `head: true` so the row bodies never travel; only the small
 * result sets (deals, the 12-week contact trend, the two recent lists) are
 * actually fetched, and deals is 32 rows, so it is aggregated in the client
 * rather than through a view that would then need its own migration.
 */

const CLOSED_WON = "Closed Won";
const CLOSED_LOST = "Closed Lost";

export interface StageSlice {
  stage: string;
  deals: number;
  value: number;
}

export interface TrendPoint {
  /** Week commencing, as `dd MMM`. */
  label: string;
  contacts: number;
}

export interface RecentDeal {
  id: string;
  deal_name: string;
  stage: string | null;
  deal_value: number | null;
  expected_close_date: string | null;
  company_name: string | null;
}

export interface RecentMeeting {
  id: string;
  title: string | null;
  meeting_date: string | null;
  contact_name: string | null;
}

export interface DashboardData {
  contacts: number;
  contactsLast30: number;
  companies: number;
  openDeals: number;
  pipelineValue: number;
  wonDeals: number;
  wonValue: number;
  emailsLast30: number;
  emailsSentLast30: number;
  meetingsLast30: number;
  visitorsLast30: number;
  stages: StageSlice[];
  trend: TrendPoint[];
  recentDeals: RecentDeal[];
  recentMeetings: RecentMeeting[];
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Monday of the week containing `d`, so the buckets line up week to week. */
function weekStart(d: Date): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const weekday = (copy.getUTCDay() + 6) % 7; // Monday = 0
  copy.setUTCDate(copy.getUTCDate() - weekday);
  return copy;
}

const WEEKS = 12;

export function useDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: async (): Promise<DashboardData> => {
      const since30 = daysAgo(30);
      const trendFrom = weekStart(new Date(Date.now() - (WEEKS - 1) * 7 * 86_400_000));

      const [
        contactsRes,
        contactsNewRes,
        companiesRes,
        emailsRes,
        emailsSentRes,
        meetingsRes,
        visitorsRes,
        dealsRes,
        trendRes,
        recentDealsRes,
        recentMeetingsRes,
      ] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("contacts").select("id", { count: "exact", head: true })
          .gte("created_at", since30),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("emails").select("id", { count: "exact", head: true })
          .gte("received_at", since30),
        supabase.from("emails").select("id", { count: "exact", head: true })
          .gte("received_at", since30).eq("direction", "outbound"),
        supabase.from("meeting_notes").select("id", { count: "exact", head: true })
          .gte("meeting_date", since30),
        // Crawlers are the bulk of this table and are not visitors.
        supabase.from("website_visits").select("id", { count: "exact", head: true })
          .gte("visited_at", since30).neq("classification", "bot"),
        supabase.from("deals").select("stage, deal_value"),
        supabase.from("contacts").select("created_at")
          .gte("created_at", trendFrom.toISOString()),
        supabase.from("deals")
          .select("id, deal_name, stage, deal_value, expected_close_date, companies:company_id (company_name)")
          .not("stage", "in", `("${CLOSED_WON}","${CLOSED_LOST}")`)
          .order("updated_at", { ascending: false })
          .limit(8),
        supabase.from("meeting_notes")
          .select("id, title, meeting_date, contacts:contact_id (first_name, last_name)")
          .order("meeting_date", { ascending: false })
          .limit(5),
      ]);

      const deals = (dealsRes.data ?? []) as Array<{ stage: string | null; deal_value: number | null }>;

      const byStage = new Map<string, StageSlice>();
      let openDeals = 0;
      let pipelineValue = 0;
      let wonDeals = 0;
      let wonValue = 0;

      for (const deal of deals) {
        const stage = deal.stage || "Unassigned";
        const value = deal.deal_value ?? 0;

        const slice = byStage.get(stage) ?? { stage, deals: 0, value: 0 };
        slice.deals += 1;
        slice.value += value;
        byStage.set(stage, slice);

        if (stage === CLOSED_WON) {
          wonDeals += 1;
          wonValue += value;
        } else if (stage !== CLOSED_LOST) {
          openDeals += 1;
          pipelineValue += value;
        }
      }

      // Every week in the window, including the empty ones — a trend line that
      // silently omits quiet weeks reads as continuous growth.
      const buckets = new Map<number, number>();
      for (let i = 0; i < WEEKS; i++) {
        const start = new Date(trendFrom);
        start.setUTCDate(start.getUTCDate() + i * 7);
        buckets.set(start.getTime(), 0);
      }
      for (const row of (trendRes.data ?? []) as Array<{ created_at: string | null }>) {
        if (!row.created_at) continue;
        const key = weekStart(new Date(row.created_at)).getTime();
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }

      const trend: TrendPoint[] = [...buckets.entries()]
        .sort(([a], [b]) => a - b)
        .map(([time, contacts]) => ({
          label: new Date(time).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
          }),
          contacts,
        }));

      const recentDeals: RecentDeal[] = ((recentDealsRes.data ?? []) as Array<
        Omit<RecentDeal, "company_name"> & { companies?: { company_name: string | null } | null }
      >).map((d) => ({
        id: d.id,
        deal_name: d.deal_name,
        stage: d.stage,
        deal_value: d.deal_value,
        expected_close_date: d.expected_close_date,
        company_name: d.companies?.company_name ?? null,
      }));

      const recentMeetings: RecentMeeting[] = ((recentMeetingsRes.data ?? []) as Array<
        Omit<RecentMeeting, "contact_name"> & {
          contacts?: { first_name: string | null; last_name: string | null } | null;
        }
      >).map((m) => ({
        id: m.id,
        title: m.title,
        meeting_date: m.meeting_date,
        contact_name:
          [m.contacts?.first_name, m.contacts?.last_name].filter(Boolean).join(" ") || null,
      }));

      return {
        contacts: contactsRes.count ?? 0,
        contactsLast30: contactsNewRes.count ?? 0,
        companies: companiesRes.count ?? 0,
        openDeals,
        pipelineValue,
        wonDeals,
        wonValue,
        emailsLast30: emailsRes.count ?? 0,
        emailsSentLast30: emailsSentRes.count ?? 0,
        meetingsLast30: meetingsRes.count ?? 0,
        visitorsLast30: visitorsRes.count ?? 0,
        stages: [...byStage.values()].sort((a, b) => b.deals - a.deals),
        trend,
        recentDeals,
        recentMeetings,
      };
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}
