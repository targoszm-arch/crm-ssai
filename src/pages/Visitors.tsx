import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Building2, ExternalLink, Eye, Globe, Loader2, Plus, Search, Radar,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { TrackingSetup } from "@/components/visitors/TrackingSetup";
import { ImportLeadfeederCsv } from "@/components/visitors/ImportLeadfeederCsv";
import {
  useAddVisitorToCrm, useCompanyVisits, useVisitorCompanies, useVisitorSites,
  useWebsiteVisits, VisitorCompany,
} from "@/components/visitors/useWebsiteVisitors";

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

/** A readable traffic source from a raw referrer URL. */
function trafficSource(referrer: string | null): string {
  if (!referrer) return "Direct";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

function relative(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

function MetricCard({
  title, value, sub, icon,
}: { title: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="p-2 rounded-lg bg-muted">{icon}</div>
      </div>
    </Card>
  );
}

/** The pages one company looked at. */
function CompanyDetailDialog({
  visitor, days, onClose,
}: { visitor: VisitorCompany | null; days: number; onClose: () => void }) {
  const { data: visits, isLoading } = useCompanyVisits(visitor?.company_domain ?? null, days);

  return (
    <Dialog open={!!visitor} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{visitor?.company_name || visitor?.company_domain}</DialogTitle>
          <DialogDescription>
            {visitor?.company_domain}
            {visitor?.city ? ` · ${visitor.city}` : ""}
            {visitor?.country ? `, ${visitor.country}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading pages…
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(visits ?? []).map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      {visit.path || "/"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[12rem] truncate">
                      {visit.utm_source || visit.referrer || "Direct"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                      {relative(visit.visited_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Visitors() {
  const [range, setRange] = useState("30");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<VisitorCompany | null>(null);

  const days = Number(range);
  const { data: sites, isLoading: sitesLoading } = useVisitorSites();
  const { data: companies, isLoading } = useVisitorCompanies(days);
  const { data: visits } = useWebsiteVisits(days);
  const addToCrm = useAddVisitorToCrm();

  const hasSite = (sites?.length ?? 0) > 0;

  // Tabs must be controlled here. defaultValue is read once on mount, and on that first
  // render the sites query has not resolved — so hasSite is false and the page always
  // opened on Setup, even with a site configured. While the query is in flight assume
  // Companies (the steady state once set up) so the common case never flickers; fall back
  // to Setup only once we actually know there are no sites.
  const [tab, setTab] = useState<string | null>(null);
  const activeTab = tab ?? (sitesLoading || hasSite ? "companies" : "setup");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = companies ?? [];
    if (!term) return rows;
    return rows.filter((c) =>
      (c.company_name ?? "").toLowerCase().includes(term) ||
      c.company_domain.toLowerCase().includes(term),
    );
  }, [companies, search]);

  // How much of the traffic reverse-IP could actually put a name to. Anything
  // between roughly 5% and 20% is normal — most visitors are on consumer
  // broadband, which resolves to their ISP and nothing more.
  const stats = useMemo(() => {
    const all = visits ?? [];
    const identified = all.filter((v) => v.classification === "company").length;
    const rate = all.length > 0 ? Math.round((identified / all.length) * 100) : 0;

    const weekAgo = Date.now() - 7 * 86_400_000;
    const newThisWeek = (companies ?? [])
      .filter((c) => new Date(c.first_seen).getTime() > weekAgo).length;

    return { pageViews: all.length, rate, newThisWeek };
  }, [visits, companies]);

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Radar className="h-6 w-6" />
            Website Visitors
          </h1>
          <p className="text-muted-foreground text-sm">
            Companies that visited your site, resolved from their IP — no
            third-party tracker, no per-lead billing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportLeadfeederCsv />
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Companies identified"
          value={String(companies?.length ?? 0)}
          sub={`in the last ${days} days`}
          icon={<Building2 className="h-4 w-4" />}
        />
        <MetricCard
          title="New this week"
          value={String(stats.newThisWeek)}
          sub="first seen in the last 7 days"
          icon={<Plus className="h-4 w-4" />}
        />
        <MetricCard
          title="Page views"
          value={String(stats.pageViews)}
          sub="all visitors, identified or not"
          icon={<Eye className="h-4 w-4" />}
        />
        <MetricCard
          title="Identification rate"
          value={`${stats.rate}%`}
          sub="5–20% is normal for reverse-IP"
          icon={<Globe className="h-4 w-4" />}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="visits">All page views</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Identified companies</CardTitle>
                <CardDescription>
                  Click a row to see which pages they read.
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search company or domain"
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-8">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No companies yet</p>
                  <p className="text-sm mt-1">
                    {hasSite
                      ? "Once the snippet is live on your Framer site, companies will appear here within minutes of a visit."
                      : "Add the tracking snippet to your site to start identifying visitors."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Traffic source</TableHead>
                      <TableHead className="text-right">Visits</TableHead>
                      <TableHead className="text-right">Pages</TableHead>
                      <TableHead>Last seen</TableHead>
                      <TableHead className="text-right">In CRM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((visitor) => (
                      <TableRow
                        key={visitor.company_domain}
                        className="cursor-pointer"
                        onClick={() => setSelected(visitor)}
                      >
                        <TableCell>
                          <div className="font-medium">
                            {visitor.company_name || visitor.company_domain}
                          </div>
                          <a
                            href={`https://${visitor.company_domain}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"
                          >
                            {visitor.company_domain}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {[visitor.city, visitor.country].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[10rem] truncate">
                          {trafficSource(visitor.last_referrer)}
                        </TableCell>
                        <TableCell className="text-right">{visitor.visit_count}</TableCell>
                        <TableCell className="text-right">{visitor.unique_pages}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {relative(visitor.last_seen)}
                        </TableCell>
                        <TableCell className="text-right">
                          {visitor.matched_company_id ? (
                            <Badge variant="secondary">Linked</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={addToCrm.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCrm.mutate(visitor, {
                                  onSuccess: () =>
                                    toast.success(
                                      `${visitor.company_name || visitor.company_domain} added to the CRM`,
                                    ),
                                  onError: (error) =>
                                    toast.error(
                                      error instanceof Error ? error.message : "Could not add company",
                                    ),
                                });
                              }}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              Add
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visits" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All page views</CardTitle>
              <CardDescription>
                Including the traffic that could not be resolved to a company —
                useful for sanity-checking that tracking is live.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(visits?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No page views recorded yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Page</TableHead>
                      <TableHead>Resolved as</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(visits ?? []).slice(0, 200).map((visit) => (
                      <TableRow key={visit.id}>
                        <TableCell className="max-w-xs truncate font-medium">
                          {visit.path || "/"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {visit.company_name || visit.asn_name || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={visit.classification === "company" ? "default" : "secondary"}
                          >
                            {visit.classification}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {[visit.city, visit.country].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                          {relative(visit.visited_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="setup" className="mt-4">
          <TrackingSetup />
        </TabsContent>
      </Tabs>

      <CompanyDetailDialog
        visitor={selected}
        days={days}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
