import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Euro, Mail, TrendingDown, Users } from "lucide-react";
import {
  useCrmGrowth,
  useLmsFunnel,
  stageLabel,
  type FunnelStage,
} from "@/hooks/useGrowthSnapshot";

function money(cents: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function euros(amount: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * One row per funnel stage, widest bar first. A stacked chart was the obvious
 * thing and the wrong one: these stages are a drop-off, so what matters is how
 * many are stuck in each, and a bar you can compare left-to-right says that
 * more plainly than a slice of a whole.
 */
function StageRow({ stage, total }: { stage: FunnelStage; total: number }) {
  const pct = total > 0 ? Math.round((stage.people / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium">{stageLabel(stage.stage)}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {stage.people} · {pct}%
        </span>
      </div>
      <Progress value={pct} className="h-2" />
      <p className="text-xs text-muted-foreground">
        {stage.returned} came back after day one
        {stage.had_video_failures > 0 && ` · ${stage.had_video_failures} hit a video failure`}
      </p>
    </div>
  );
}

export default function Growth() {
  const crm = useCrmGrowth();
  const lms = useLmsFunnel();

  const funnelTotal = lms.data?.totals.people ?? 0;
  const paying = lms.data?.totals.paying ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Growth</h1>
        <p className="text-muted-foreground">
          Signups, revenue and outreach in one place. The funnel is read live from
          the LMS; everything else is this CRM's own data.
        </p>
      </div>

      {/* Revenue first, because it is the number the rest has to explain. */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Paying customers"
          value={lms.isLoading ? "—" : String(paying)}
          sub={
            lms.data
              ? `${money(lms.data.totals.invoiced_cents)} invoiced, ever`
              : "From the LMS"
          }
          icon={<Euro className="h-5 w-5 text-muted-foreground" />}
        />
        <MetricCard
          title="Signed up"
          value={lms.isLoading ? "—" : String(funnelTotal)}
          sub={
            lms.data
              ? `${lms.data.totals.signed_up_last_7d} in the last 7 days`
              : "From the LMS"
          }
          icon={<Users className="h-5 w-5 text-muted-foreground" />}
        />
        <MetricCard
          title="Closed won"
          value={crm.isLoading ? "—" : euros(crm.data?.wonValue ?? 0)}
          sub="Services deals in the CRM"
          icon={<Euro className="h-5 w-5 text-muted-foreground" />}
        />
        <MetricCard
          title="Open pipeline"
          value={crm.isLoading ? "—" : euros(crm.data?.openPipelineValue ?? 0)}
          sub={`${crm.data?.openDeals ?? 0} deals not yet won or lost`}
          icon={<TrendingDown className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Where signups stop</CardTitle>
            <p className="text-sm text-muted-foreground">
              Every person who has ever signed up, by how far they got.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {lms.isLoading && (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            )}

            {lms.isError && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  The LMS did not answer, so this section has no data to show.
                  Nothing else on this page is affected.
                </span>
              </div>
            )}

            {lms.data?.stages.map((s) => (
              <StageRow key={s.stage} stage={s} total={funnelTotal} />
            ))}

            {lms.data && (
              <p className="border-t pt-3 text-xs text-muted-foreground">
                {lms.data.totals.has_stripe_subscription} people have a Stripe
                subscription and {paying}{" "}
                {paying === 1 ? "has" : "have"} ever been invoiced. The LMS creates
                a subscription for every signup, Free included, so the first number
                counts Stripe objects rather than customers.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Outreach</CardTitle>
            <p className="text-sm text-muted-foreground">
              Every campaign that has actually sent, by open rate against
              delivered.
            </p>
          </CardHeader>
          <CardContent>
            {crm.isLoading && <Skeleton className="h-32 w-full" />}

            {crm.data && crm.data.campaigns.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing has been sent yet.
              </p>
            )}

            <div className="space-y-4">
              {crm.data?.campaigns.map((c) => (
                <div key={c.campaign} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-medium">{c.campaign}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {c.openRate}%
                    </span>
                  </div>
                  <Progress value={c.openRate} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {c.sent} sent · {c.opened} opened · {c.clicked} clicked
                    {c.bounced > 0 && ` · ${c.bounced} bounced`}
                  </p>
                </div>
              ))}
            </div>

            {crm.data && crm.data.totalSent > 0 && (
              <p className="mt-4 flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {crm.data.totalOpened} of {crm.data.totalSent} sent have been
                  opened. Per-person detail is on the Analytics page.
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/*
        The trend needs more than one snapshot to be a trend. trial_funnel_daily
        is written by a nightly job that is new, so rather than draw a
        single-point line and call it a chart, say what it is waiting for.
      */}
      {lms.data && lms.data.daily_days < 2 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            The funnel has been snapshotted on {lms.data.daily_days}{" "}
            {lms.data.daily_days === 1 ? "day" : "days"} so far. Once the nightly
            job has a few more, this is where movement between stages will show.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
