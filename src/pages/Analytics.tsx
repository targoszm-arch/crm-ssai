import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Mail, MousePointerClick, Eye, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { useSequences } from "@/hooks/useSequences";
import { useSequenceAnalytics, useAllSequencesAnalytics, RecipientData } from "@/hooks/useSequenceAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export default function Analytics() {
  const [searchParams] = useSearchParams();
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>("");
  const [recipientFilter, setRecipientFilter] = useState<string>("delivered");
  const [timeGranularity, setTimeGranularity] = useState<"hourly" | "daily">("hourly");

  const { data: sequences } = useSequences();

  // Set initial sequence from URL params
  useEffect(() => {
    const sequenceFromUrl = searchParams.get("sequence");
    if (sequenceFromUrl && !selectedSequenceId) {
      setSelectedSequenceId(sequenceFromUrl);
    }
  }, [searchParams, selectedSequenceId]);

  const { data: allStats, isLoading: isLoadingAll } = useAllSequencesAnalytics();
  const { data: analytics, isLoading: isLoadingAnalytics } = useSequenceAnalytics(selectedSequenceId);

  // Filter recipients based on selected filter
  const filteredRecipients = analytics?.recipients.filter((r: RecipientData) => {
    switch (recipientFilter) {
      case "opened": return r.status === "opened" || r.status === "clicked";
      case "clicked": return r.status === "clicked";
      case "bounced": return r.status === "bounced";
      case "unsubscribed": return r.status === "unsubscribed";
      case "unopened": return r.status === "unopened" || r.status === "delivered";
      default: return true;
    }
  }) || [];

  // Get recipient counts for filter badges
  const recipientCounts = {
    delivered: analytics?.recipients.length || 0,
    opened: analytics?.recipients.filter((r: RecipientData) => r.status === "opened" || r.status === "clicked").length || 0,
    clicked: analytics?.recipients.filter((r: RecipientData) => r.status === "clicked").length || 0,
    bounced: analytics?.recipients.filter((r: RecipientData) => r.status === "bounced").length || 0,
    unsubscribed: analytics?.recipients.filter((r: RecipientData) => r.status === "unsubscribed").length || 0,
    unopened: analytics?.recipients.filter((r: RecipientData) => r.status === "unopened" || r.status === "delivered").length || 0,
  };

  // Rate chart data
  const rateChartData = analytics ? [
    { name: "Open rate", value: analytics.openRate, fill: "hsl(var(--primary))" },
    { name: "Click rate", value: analytics.clickRate, fill: "hsl(var(--chart-2))" },
  ] : [];

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sequence Analytics</h1>
          <p className="text-muted-foreground">
            Track engagement and delivery metrics for your email sequences.
          </p>
        </div>
        <Select value={selectedSequenceId} onValueChange={setSelectedSequenceId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select a sequence" />
          </SelectTrigger>
          <SelectContent>
            {sequences?.map((seq) => (
              <SelectItem key={seq.id} value={seq.id}>
                {seq.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Overview Stats Cards */}
      {!selectedSequenceId && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allStats?.totalSent || 0}</p>
                  <p className="text-sm text-muted-foreground">Emails Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Eye className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allStats?.openRate || 0}%</p>
                  <p className="text-sm text-muted-foreground">Open Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <MousePointerClick className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allStats?.clickRate || 0}%</p>
                  <p className="text-sm text-muted-foreground">Click Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allStats?.totalBounced || 0}</p>
                  <p className="text-sm text-muted-foreground">Bounced</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sequence-specific analytics */}
      {selectedSequenceId && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="recipients">Recipients</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {isLoadingAnalytics ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : analytics ? (
              <>
                {/* Campaign Info */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                        <Mail className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{analytics.sequenceName}</h3>
                        <p className="text-muted-foreground text-sm">
                          {analytics.totalDelivered} emails delivered
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Engagement Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-4xl font-bold text-primary">{analytics.uniqueOpens}</p>
                      <p className="text-primary font-medium">Unique opens</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Total opens: {analytics.totalOpens}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-4xl font-bold text-primary">{analytics.uniqueClicks}</p>
                      <p className="text-primary font-medium">Unique clicks</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Total clicks: {analytics.totalClicks}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6 h-full">
                      <ResponsiveContainer width="100%" height={100}>
                        <BarChart data={rateChartData} layout="vertical">
                          <XAxis type="number" domain={[0, 100]} hide />
                          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value: number) => `${value}%`} />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Delivery Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Delivery</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                        <p className="text-3xl font-bold text-blue-600">{analytics.totalDelivered}</p>
                        <p className="text-sm text-blue-600">Successfully delivered</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                        <p className="text-3xl font-bold text-orange-600">{analytics.totalBounced}</p>
                        <p className="text-sm text-orange-600">Bounced</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted">
                        <p className="text-3xl font-bold">{analytics.totalUnsubscribed}</p>
                        <p className="text-sm text-muted-foreground">Unsubscribed</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                        <p className="text-3xl font-bold text-red-600">{analytics.totalSpamReports}</p>
                        <p className="text-sm text-red-600">Reported as spam</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Over Time */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Performance over time</CardTitle>
                    <Select value={timeGranularity} onValueChange={(v: "hourly" | "daily") => setTimeGranularity(v)}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent>
                    {analytics.performanceOverTime.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={analytics.performanceOverTime}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="time" 
                            tick={{ fontSize: 12 }} 
                            tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit' })}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip 
                            labelFormatter={(t) => new Date(t).toLocaleString()}
                            contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                          />
                          <Line type="monotone" dataKey="opens" stroke="hsl(var(--primary))" name="Unique opens" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="clicks" stroke="hsl(var(--chart-2))" name="Unique clicks" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                        No data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Links Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Links performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.linkStats.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Link</TableHead>
                            <TableHead className="text-right">Unique Clicks</TableHead>
                            <TableHead className="text-right">% of all clicks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analytics.linkStats.map((link, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <a 
                                  href={link.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-primary hover:underline max-w-md truncate"
                                >
                                  {link.url}
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                              </TableCell>
                              <TableCell className="text-right font-medium">{link.uniqueClicks}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{link.percentage}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No link clicks recorded yet</p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="recipients" className="space-y-6 mt-6">
            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "delivered", label: "Delivered", count: recipientCounts.delivered },
                { key: "opened", label: "Opened", count: recipientCounts.opened },
                { key: "clicked", label: "Clicked", count: recipientCounts.clicked },
                { key: "bounced", label: "Bounced", count: recipientCounts.bounced },
                { key: "unsubscribed", label: "Unsubscribed", count: recipientCounts.unsubscribed },
                { key: "unopened", label: "Unopened", count: recipientCounts.unopened },
              ].map((filter) => (
                <Button
                  key={filter.key}
                  variant={recipientFilter === filter.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRecipientFilter(filter.key)}
                >
                  {filter.label} ({filter.count})
                </Button>
              ))}
            </div>

            {/* Bounce breakdown (shown when bounced filter active) */}
            {recipientFilter === "bounced" && analytics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">{analytics.hardBounces}</p>
                    <p className="text-sm text-muted-foreground">Hard bounces</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">{analytics.softBounces}</p>
                    <p className="text-sm text-muted-foreground">Soft bounces</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">{analytics.temporaryBounces}</p>
                    <p className="text-sm text-muted-foreground">Temporary</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">{analytics.blockedBounces}</p>
                    <p className="text-sm text-muted-foreground">Blocked</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Recipients Table */}
            <Card>
              <CardContent className="pt-6">
                {isLoadingAnalytics ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : filteredRecipients.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        {(recipientFilter === "opened" || recipientFilter === "clicked" || recipientFilter === "delivered") && (
                          <>
                            <TableHead className="text-right">Opens</TableHead>
                            <TableHead className="text-right">Clicks</TableHead>
                          </>
                        )}
                        {recipientFilter === "bounced" && <TableHead>Bounce Type</TableHead>}
                        <TableHead className="text-right">Last Activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecipients.map((recipient: RecipientData) => (
                        <TableRow key={recipient.id}>
                          <TableCell className="font-medium">{recipient.name}</TableCell>
                          <TableCell className="text-muted-foreground">{recipient.email}</TableCell>
                          {(recipientFilter === "opened" || recipientFilter === "clicked" || recipientFilter === "delivered") && (
                            <>
                              <TableCell className="text-right">{recipient.opens}</TableCell>
                              <TableCell className="text-right">{recipient.clicks}</TableCell>
                            </>
                          )}
                          {recipientFilter === "bounced" && (
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {recipient.bounceType || "unknown"}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell className="text-right text-muted-foreground">
                            {recipient.lastOpened || recipient.lastClicked ? (
                              <span className="flex items-center justify-end gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(recipient.lastOpened || recipient.lastClicked!), { addSuffix: true })}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No recipients found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* No sequence selected message */}
      {!selectedSequenceId && (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Select a sequence to view detailed analytics</h3>
            <p className="text-muted-foreground">
              Use the dropdown above to choose a sequence and see engagement metrics, delivery stats, and recipient activity.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
