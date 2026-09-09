import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Users, Building2, Handshake, Trophy, Mail, CalendarDays, Radar,
  Loader2, ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { useDashboard } from "@/hooks/useDashboard";

/**
 * Every figure here is read from the CRM at load. Nothing on this page is
 * hard-coded — the previous version rendered an e-commerce template's mock
 * revenue, orders and cart-abandonment stats, which is why the numbers never
 * moved no matter what was in the database.
 */

const STAGE_COLORS = [
  "hsl(var(--primary))", "#00C49F", "#FFBB28", "#FF8042",
  "#8884d8", "#4bc0c0", "#f472b6", "#94a3b8",
];

function money(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function whenever(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function Dashboard() {
  const { data, isLoading, isError, error } = useDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your CRM…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-16">
        <p className="font-medium">Could not load the dashboard.</p>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  const pipeline = data.stages.filter(
    (s) => s.stage !== "Closed Won" && s.stage !== "Closed Lost",
  );

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Your pipeline and activity, live from the CRM.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Contacts"
          value={data.contacts.toLocaleString()}
          sub={`${data.contactsLast30.toLocaleString()} added in the last 30 days`}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          title="Companies"
          value={data.companies.toLocaleString()}
          sub="organisations on file"
          icon={<Building2 className="h-4 w-4" />}
        />
        <MetricCard
          title="Open deals"
          value={String(data.openDeals)}
          sub={`${money(data.pipelineValue)} in the pipeline`}
          icon={<Handshake className="h-4 w-4" />}
        />
        <MetricCard
          title="Won"
          value={money(data.wonValue)}
          sub={`${data.wonDeals} deal${data.wonDeals === 1 ? "" : "s"} closed won`}
          icon={<Trophy className="h-4 w-4" />}
        />
        <MetricCard
          title="Email (30 days)"
          value={data.emailsLast30.toLocaleString()}
          sub={`${data.emailsSentLast30.toLocaleString()} sent by you`}
          icon={<Mail className="h-4 w-4" />}
        />
        <MetricCard
          title="Meetings (30 days)"
          value={String(data.meetingsLast30)}
          sub={`${data.visitorsLast30} non-crawler site visits`}
          icon={<CalendarDays className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="md:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contacts added</CardTitle>
            <p className="text-xs text-muted-foreground">
              By week, last 12 weeks
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, "Contacts"]} />
                  <Area
                    type="monotone"
                    dataKey="contacts"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline by stage</CardTitle>
            <p className="text-xs text-muted-foreground">
              Open deals only — won and lost are excluded
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {pipeline.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No open deals yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pipeline}
                    layout="vertical"
                    margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="stage"
                      width={120}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value, _name, item) => [
                        `${value} deal${value === 1 ? "" : "s"} · ${money(
                          (item?.payload as { value?: number })?.value ?? 0,
                        )}`,
                        "",
                      ]}
                    />
                    <Bar dataKey="deals" radius={[0, 4, 4, 0]}>
                      {pipeline.map((_, i) => (
                        <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Open deals</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/deals">
                All deals <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentDeals.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No open deals.
              </p>
            ) : (
              <div className="divide-y">
                {data.recentDeals.map((deal) => (
                  <div key={deal.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{deal.deal_name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {deal.company_name ?? "No company"}
                        {deal.expected_close_date
                          ? ` · closes ${whenever(deal.expected_close_date)}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {deal.deal_value ? (
                        <span className="text-sm font-medium">{money(deal.deal_value)}</span>
                      ) : null}
                      <Badge variant="secondary">{deal.stage ?? "Unassigned"}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Recent meetings</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/visitors">
                <Radar className="mr-1 h-3 w-3" /> Visitors
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentMeetings.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No meetings recorded.
              </p>
            ) : (
              <div className="divide-y">
                {data.recentMeetings.map((meeting) => (
                  <div key={meeting.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {meeting.title || "Untitled meeting"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {meeting.contact_name ?? "No contact linked"}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {whenever(meeting.meeting_date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
