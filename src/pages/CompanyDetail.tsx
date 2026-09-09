import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Globe2, MapPin, Phone, Plus, Users, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Company } from "@/hooks/useCompanies";
import { useContactsByCompany, Contact } from "@/hooks/useContacts";
import { AddContactModal } from "@/components/customers/AddContactModal";
import { AddDealModal } from "@/components/deals/AddDealModal";
import { AddCompanyModal } from "@/components/customers/AddCompanyModal";
import { ActivityStreamPanel } from "@/components/customers/ActivityStreamPanel";
import { FilesPanel } from "@/components/customers/FilesPanel";

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const returnTab = searchParams.get("from") === "customers" ? "customers" : "organisations";
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { data: company, isLoading, error } = useQuery({ queryKey: ["company-detail", id], queryFn: async () => { const { data, error } = await supabase.from("companies").select("*").eq("id", id).single(); if (error) throw error; return data as Company; }, enabled: !!id });
  const { data: contacts = [], isLoading: contactsLoading } = useContactsByCompany(id || null);
  if (isLoading) return <div className="p-6"><Skeleton className="h-12 w-full" /><Skeleton className="mt-6 h-96 w-full" /></div>;
  if (error || !company) return <div className="p-8 text-sm text-destructive">Couldn&apos;t load this company.</div>;
  const initials = company.company_name.slice(0, 2).toUpperCase();
  return <div className="min-h-full bg-muted/20 p-5 md:p-7"><div className="w-full">
    <header className="border-b pb-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3 text-sm"><Button variant="outline" size="icon" asChild><Link to={`/customers?tab=${returnTab}`} aria-label="Back to companies"><ArrowLeft className="h-4 w-4" /></Link></Button><Link to={`/customers?tab=${returnTab}`} className="text-muted-foreground">Companies</Link><span className="text-muted-foreground">›</span><strong>{company.company_name}</strong></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setAddContactOpen(true)}><Plus className="mr-2 h-4 w-4" />Add person</Button><Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />Edit company</Button></div></div><div className="mt-5 flex items-center gap-4"><div className="flex size-14 items-center justify-center rounded-xl border bg-background text-xl font-semibold text-primary">{initials}</div><div><h1 className="text-2xl font-semibold">{company.company_name}</h1><div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span><Building2 className="mr-1 inline h-4 w-4" />{company.industry || "Not set"}</span>{company.domains && <span><Globe2 className="mr-1 inline h-4 w-4" />{company.domains}</span>}</div></div></div></header>
    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4"><TabsList className="bg-transparent"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="employees">Employees</TabsTrigger><TabsTrigger value="deals">Deals</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger><TabsTrigger value="files">Files</TabsTrigger></TabsList></Tabs>
    {activeTab === "overview" && <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,.9fr)]"><div className="space-y-4"><Card><CardHeader className="border-b"><CardTitle className="text-base">Company summary</CardTitle></CardHeader><CardContent className="space-y-5 p-5"><p className="text-sm text-muted-foreground">{company.description || "No company summary added yet."}</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Industry" value={company.industry} /><Field label="Stage" value={company.connection_strength || "Engaged"} /><Field label="Location" value={company.country} /><Field label="Employees" value={company.employee_range} /></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Website" value={company.domains} /><Field label="LinkedIn" value={company.linkedin_url ? "Attached" : "Not set"} /></div></CardContent></Card><Card><CardHeader className="border-b"><CardTitle className="text-base">CRM details</CardTitle></CardHeader><CardContent className="grid gap-3 p-5 sm:grid-cols-3"><Metric label="Contacts" value={String(contacts.length)} /><Metric label="Employees added" value={String(contacts.length)} /><Metric label="Deals" value="0" /></CardContent></Card></div><Card className="h-fit"><CardHeader><CardTitle className="text-base">Lists</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">No lists assigned.</CardContent></Card></div>}
    {activeTab === "employees" && <Employees contacts={contacts} loading={contactsLoading} companyId={company.id} />}
    {activeTab === "activity" && <div className="mt-4 max-w-4xl"><ActivityStreamPanel scope={{ companyId: company.id }} showPerson /></div>}
    {activeTab === "files" && <div className="mt-4 max-w-4xl"><FilesPanel scope={{ companyId: company.id }} showPerson /></div>}
    {activeTab === "deals" && <Card className="mt-4"><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Deals</CardTitle><Button onClick={() => setDealOpen(true)}>Create deal</Button></CardHeader><CardContent className="text-sm text-muted-foreground">No deals linked to this company yet.</CardContent></Card>}
    <AddContactModal open={addContactOpen} onOpenChange={setAddContactOpen} preselectedCompanyId={company.id} /><AddDealModal open={dealOpen} onOpenChange={setDealOpen} initialData={{ company_id: company.id }} /><AddCompanyModal open={editOpen} onOpenChange={setEditOpen} company={company} />
  </div></div>;
}
function Field({ label, value }: { label: string; value?: string | null }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value || "Not set"}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>; }
function Employees({ contacts, loading, companyId }: { contacts: Contact[]; loading: boolean; companyId: string }) { return <Card className="mt-4"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-base">Employees</CardTitle><span className="text-sm text-muted-foreground">Showing {contacts.length} employees</span></div><div className="flex flex-wrap gap-2 pt-2"><div className="flex min-w-[260px] flex-1 items-center rounded-md border px-3 py-2 text-sm text-muted-foreground">Search employees</div><Button variant="outline">Sort: Relevance</Button><Button variant="outline">Email: Any</Button><Button variant="outline">Phone: Any</Button></div></CardHeader><CardContent><div className="overflow-hidden rounded-xl border"><div className="grid grid-cols-[1.4fr_1.2fr_1.5fr_1.2fr_1fr] bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground"><span>Name</span><span>Title</span><span>Email</span><span>Phone</span><span>Location</span></div>{loading ? <Skeleton className="m-4 h-16" /> : contacts.length ? contacts.map((contact) => <Link key={contact.id} to={`/people/${contact.id}?from=organisations&company=${companyId}`} className="grid grid-cols-[1.4fr_1.2fr_1.5fr_1.2fr_1fr] border-t px-4 py-4 text-sm hover:bg-muted/30"><span className="font-medium">{[contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.name}</span><span>{contact.title || "Not set"}</span><span>{contact.email || "Not set"}</span><span>{contact.phone || "Not set"}</span><span>{contact.work_location || "Not set"}</span></Link>) : <div className="px-4 py-12 text-center text-sm text-muted-foreground">No employees added yet. Use “Add person” to attach verified company contacts.</div>}</div></CardContent></Card>; }
