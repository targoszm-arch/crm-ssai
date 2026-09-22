import { useState } from "react";
import PageShell from "@/components/layout/PageShell";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Building2, Globe2, MapPin, Phone, Plus, Users, Pencil, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Company } from "@/hooks/useCompanies";
import { useContactsByCompany, Contact } from "@/hooks/useContacts";
import { AddContactModal } from "@/components/customers/AddContactModal";
import { AddCompanyModal } from "@/components/customers/AddCompanyModal";
import { ActivityStreamPanel } from "@/components/customers/ActivityStreamPanel";
import { FilesPanel } from "@/components/customers/FilesPanel";
import { LinkedDealsCard } from "@/components/deals/LinkedDealsCard";
import { HistoryPanel } from "@/components/customers/HistoryPanel";
import { EnrichProviderMenu } from "@/components/customers/EnrichProviderMenu";
import { enrichCompany, type EnrichProvider } from "@/lib/api/enrichment";
import { toast } from "sonner";
import { EditableLabels } from "@/components/customers/EditableLabels";
import { useUpdateCompany } from "@/hooks/useCompanies";

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const returnTab = searchParams.get("from") === "customers" ? "customers" : "organisations";
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEmailId, setHistoryEmailId] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const queryClient = useQueryClient();
  const updateCompany = useUpdateCompany();
  const { data: company, isLoading, error } = useQuery({ queryKey: ["company-detail", id], queryFn: async () => { const { data, error } = await supabase.from("companies").select("*").eq("id", id).single(); if (error) throw error; return data as Company; }, enabled: !!id });
  const { data: contacts = [], isLoading: contactsLoading } = useContactsByCompany(id || null);
  const handleEnrich = async (provider: EnrichProvider) => {
    if (!company) return;
    setIsEnriching(true);
    try {
      const result = await enrichCompany(company.id, provider);
      queryClient.invalidateQueries({ queryKey: ["company-detail", company.id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success(
        result.enrichedFields?.length > 0
          ? `Updated: ${result.enrichedFields.join(", ")}`
          : result.message || "No new data found.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enrich company");
    } finally {
      setIsEnriching(false);
    }
  };
  if (isLoading) return <div className="p-6"><Skeleton className="h-12 w-full" /><Skeleton className="mt-6 h-96 w-full" /></div>;
  if (error || !company) return <div className="p-8 text-sm text-destructive">Couldn&apos;t load this company.</div>;
  const initials = company.company_name.slice(0, 2).toUpperCase();
  return <div><PageShell>
    <header className="border-b pb-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3 text-sm"><Button variant="outline" size="icon" asChild><Link to={`/customers?tab=${returnTab}`} aria-label="Back to companies"><ArrowLeft className="h-4 w-4" /></Link></Button><Link to={`/customers?tab=${returnTab}`} className="text-muted-foreground">Companies</Link><span className="text-muted-foreground">›</span><strong>{company.company_name}</strong></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setAddContactOpen(true)}><Plus className="mr-2 h-4 w-4" />Add person</Button><EnrichProviderMenu onEnrich={handleEnrich} disabled={isEnriching}><Button variant="outline" size="sm" disabled={isEnriching}>{isEnriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Enrich</Button></EnrichProviderMenu><Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />Edit company</Button></div></div><div className="mt-5 flex items-center gap-4"><div className="flex size-14 items-center justify-center rounded-xl border bg-background text-xl font-semibold text-primary">{initials}</div><div><h1 className="text-2xl font-semibold">{company.company_name}</h1><div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">{company.industry && <span><Building2 className="mr-1 inline h-4 w-4" />{company.industry}</span>}{(company.website || company.domains) && <span><Globe2 className="mr-1 inline h-4 w-4" />{company.website || company.domains}</span>}</div></div></div></header>
    <Tabs value={activeTab} onValueChange={setActiveTab}><TabsList className="bg-transparent"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="employees">Employees</TabsTrigger><TabsTrigger value="deals">Deals</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger><TabsTrigger value="files">Files</TabsTrigger></TabsList></Tabs>
    {activeTab === "overview" && <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,.9fr)]"><div className="space-y-4"><Card><CardHeader className="border-b"><CardTitle className="text-base">Company summary</CardTitle></CardHeader><CardContent className="space-y-5 p-5"><p className="text-sm text-muted-foreground">{company.description || "No company summary added yet."}</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Industry" value={company.industry} /><Field label="Stage" value={company.connection_strength || "Engaged"} /><Field label="Location" value={company.country} /><Field label="Employees" value={company.employee_range} /></div><div className="grid gap-4 sm:grid-cols-2"><LinkField label="Website" href={(() => { const site = company.website || company.domains; return site ? (site.startsWith("http") ? site : `https://${site}`) : null; })()} text={company.website || company.domains} /><LinkField label="LinkedIn" href={company.linkedin_url} text={company.linkedin_url ? "Open profile" : null} /></div></CardContent></Card><Card><CardHeader className="border-b"><CardTitle className="text-base">CRM details</CardTitle></CardHeader><CardContent className="grid gap-3 p-5 sm:grid-cols-3"><Metric label="Contacts" value={String(contacts.length)} /><Metric label="Employees added" value={String(contacts.length)} /></CardContent></Card></div><Card className="h-fit"><CardHeader className="border-b"><CardTitle className="text-base">Labels</CardTitle></CardHeader><CardContent className="p-5"><EditableLabels labels={company.labels} isLoading={updateCompany.isPending} onSave={async (labels) => { await updateCompany.mutateAsync({ id: company.id, labels }); queryClient.invalidateQueries({ queryKey: ["company-detail", company.id] }); }} /></CardContent></Card><Card className="h-fit"><CardHeader><CardTitle className="text-base">Lists</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">No lists assigned.</CardContent></Card></div>}
    {activeTab === "employees" && <Employees contacts={contacts} loading={contactsLoading} companyId={company.id} />}
    {activeTab === "activity" && <div className="max-w-4xl"><ActivityStreamPanel scope={{ companyId: company.id }} showPerson onOpenEmail={(emailId) => { setHistoryEmailId(emailId); setHistoryOpen(true); }} linkedinUrl={company.linkedin_url} /></div>}
    {activeTab === "files" && <div className="max-w-4xl"><FilesPanel scope={{ companyId: company.id }} showPerson /></div>}
    {activeTab === "deals" && <div><LinkedDealsCard companyId={company.id} contactName={company.company_name} /></div>}
    <HistoryPanel open={historyOpen} onOpenChange={(next) => { setHistoryOpen(next); if (!next) setHistoryEmailId(null); }} companyId={company.id} name={company.company_name} initialEmailId={historyEmailId} />
    <AddContactModal open={addContactOpen} onOpenChange={setAddContactOpen} preselectedCompanyId={company.id} /><AddCompanyModal open={editOpen} onOpenChange={setEditOpen} company={company} />
  </PageShell></div>;
}
function Field({ label, value }: { label: string; value?: string | null }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value || "Not set"}</p></div>; }
// Website/LinkedIn used to render as inert text ("Attached" for a LinkedIn URL
// the page never linked to) — a reference to something you can't click through
// to is the same "not an active deep link" complaint as the contact page's
// unlinked company name.
function LinkField({ label, href, text }: { label: string; href?: string | null; text?: string | null }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p>{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-sm font-medium text-primary hover:underline">{text}<ArrowUpRight className="h-3.5 w-3.5" /></a> : <p className="mt-1 text-sm font-medium">Not set</p>}</div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>; }
function Employees({ contacts, loading, companyId }: { contacts: Contact[]; loading: boolean; companyId: string }) { return <Card className="mt-4"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-base">Employees</CardTitle><span className="text-sm text-muted-foreground">Showing {contacts.length} employees</span></div><div className="flex flex-wrap gap-2 pt-2"><div className="flex min-w-[260px] flex-1 items-center rounded-md border px-3 py-2 text-sm text-muted-foreground">Search employees</div><Button variant="outline">Sort: Relevance</Button><Button variant="outline">Email: Any</Button><Button variant="outline">Phone: Any</Button></div></CardHeader><CardContent><div className="overflow-hidden rounded-xl border"><div className="grid grid-cols-[1.4fr_1.2fr_1.5fr_1.2fr_1fr] bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground"><span>Name</span><span>Title</span><span>Email</span><span>Phone</span><span>Location</span></div>{loading ? <Skeleton className="m-4 h-16" /> : contacts.length ? contacts.map((contact) => <Link key={contact.id} to={`/people/${contact.id}?from=organisations&company=${companyId}`} className="grid grid-cols-[1.4fr_1.2fr_1.5fr_1.2fr_1fr] border-t px-4 py-4 text-sm hover:bg-muted/30"><span className="font-medium">{[contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.name}</span><span>{contact.title || "Not set"}</span><span>{contact.email || "Not set"}</span><span>{contact.phone || "Not set"}</span><span>{contact.work_location || "Not set"}</span></Link>) : <div className="px-4 py-12 text-center text-sm text-muted-foreground">No employees added yet. Use “Add person” to attach verified company contacts.</div>}</div></CardContent></Card>; }
