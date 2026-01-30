import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "@/components/ui/metric-card";
import {
  MegaphoneIcon,
  Plus,
  TrendingUp,
  Users,
  Mail,
  MousePointerClick,
  CheckCircle,
} from "lucide-react";
import { useRecoveryAnalytics } from "@/hooks/useRecoveryAnalytics";
import { SequenceBuilderSheet } from "@/components/sequences/SequenceBuilderSheet";

export function RecoveryCampaignsTab() {
  const [builderOpen, setBuilderOpen] = useState(false);
  const { data, isLoading } = useRecoveryAnalytics();

  const stats = data?.stats;
  const campaigns = data?.campaigns || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-24 bg-muted/50" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Total Enrolled"
          value={stats?.totalEnrolled.toString() || "0"}
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          title="Open Rate"
          value={`${stats?.openRate.toFixed(1) || 0}%`}
          icon={<Mail className="h-5 w-5" />}
        />
        <MetricCard
          title="Click Rate"
          value={`${stats?.clickRate.toFixed(1) || 0}%`}
          icon={<MousePointerClick className="h-5 w-5" />}
        />
        <MetricCard
          title="Recovery Rate"
          value={`${stats?.recoveryRate.toFixed(1) || 0}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          change={stats?.recoveryRate ? { value: stats.recoveryRate, isPositive: true } : undefined}
        />
      </div>

      {/* Create Campaign CTA */}
      <Card>
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <h3 className="font-medium">Recovery Campaigns</h3>
            <p className="text-sm text-muted-foreground">
              Create automated email sequences to recover unverified signups
            </p>
          </div>
          <Button onClick={() => setBuilderOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Recovery Campaign
          </Button>
        </CardContent>
      </Card>

      {/* Campaign Cards */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <MegaphoneIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Recovery Campaigns Yet</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Create your first recovery campaign to start re-engaging users who abandoned signup.
            </p>
            <Button onClick={() => setBuilderOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.sequenceId} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{campaign.sequenceName}</CardTitle>
                  <Badge
                    variant={campaign.status === "active" ? "default" : "secondary"}
                    className="capitalize"
                  >
                    {campaign.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Enrolled */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Enrolled
                  </span>
                  <span className="font-medium">{campaign.enrolledCount}</span>
                </div>

                {/* Funnel Progress */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Open Rate</span>
                      <span>{campaign.openRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={campaign.openRate} className="h-1.5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Click Rate</span>
                      <span>{campaign.clickRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={campaign.clickRate} className="h-1.5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Recovered
                      </span>
                      <span className="text-green-600 font-medium">
                        {campaign.recoveredCount} ({campaign.recoveryRate.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={campaign.recoveryRate} className="h-1.5 bg-green-100" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sequence Builder Sheet */}
      <SequenceBuilderSheet
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        defaultTriggerType="signup_abandonment"
      />
    </div>
  );
}
