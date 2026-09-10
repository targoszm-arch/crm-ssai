import { useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Mail, Phone, MapPin, BriefcaseBusiness, CalendarDays, Linkedin, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactWithCompany } from "@/components/customers/ContactDetailContent";
import { ActivityStreamPanel } from "@/components/customers/ActivityStreamPanel";
import { FilesPanel } from "@/components/customers/FilesPanel";
import { ComposeEmail } from "@/components/inbox/ComposeEmail";
import { LinkedDealsCard } from "@/components/deals/LinkedDealsCard";
import { useEmailAccounts } from "@/hooks/useEmailAccounts";

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const returnTab = searchParams.get("from") === "organisations" ? "organisations" : "customers";
  const [activeTab, setActiveTab] = useState("overview");
  const [composeOpen, setComposeOpen] = useState(false);
  const { data: accounts } = useEmailAccounts();
  const mailbox = accounts?.[0] ?? null;
  const { data: contact, isLoading, error } = useQuery({
    queryKey: ["contact-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*, companies!contacts_company_id_fkey(company_name)").eq("id", id).single();
      if (error) throw error;
      return data as ContactWithCompany;
    },
    enabled: !!id,
  });

  if (isLoading) return <div><Skeleton className="h-12 w-full" /><Skeleton className="mt-6 h-96 w-full" /></div>;
  if (error || !contact) return <div className="p-8 text-sm text-destructive">Couldn&apos;t load this person.</div>;
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.name || "Unknown person";
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const companyName = contact.companies?.company_name;

  return <div>
    <div className="w-full">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3 text-sm"><Button variant="outline" size="icon" asChild><Link to={`/customers?tab=${returnTab}`} aria-label="Back to people"><ArrowLeft className="h-4 w-4" /></Link></Button><Link className="text-muted-foreground hover:text-foreground" to={`/customers?tab=${returnTab}`}>People</Link><span className="text-muted-foreground">›</span><strong>{name}</strong></div>
        <div className="flex gap-2"><Button variant="outline" size="sm" disabled={!contact.email} onClick={() => setComposeOpen(true)}><Mail className="mr-2 h-4 w-4" />Send email</Button>{companyName && contact.company_id && <Button variant="outline" size="sm" asChild><Link to={`/companies/${contact.company_id}?from=customers`}><Building2 className="mr-2 h-4 w-4" />Open company</Link></Button>}<Button size="sm" onClick={() => setActiveTab("activity")}><Sparkles className="mr-2 h-4 w-4" />Log activity</Button></div>
      </header>
      <div className="mb-4 rounded-2xl border bg-gradient-to-r from-primary/10 via-background to-background p-6"><div className="flex items-start gap-4"><div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">{initials}</div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold">{name}</h1>{contact.connection_strength && <Badge variant="outline">{contact.connection_strength}</Badge>}{companyName && <Badge variant="secondary">{companyName}</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">Contact profile · {companyName || "Company not set"} · {contact.work_location || "Location not set"}</p><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Contact linked to {companyName || "the CRM"}. Keep account details current here so the company record, people list, and pipeline stay aligned.</p></div></div></div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList className="bg-transparent">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>
      </Tabs>
      {activeTab === "activity" && <div className="max-w-4xl"><ActivityStreamPanel scope={{ contactId: contact.id, companyId: contact.company_id }} /></div>}
      {activeTab === "files" && <div className="max-w-4xl"><FilesPanel scope={{ contactId: contact.id, companyId: contact.company_id }} /></div>}
      <div hidden={activeTab !== "overview"} className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,.9fr)]"><div className="space-y-4"><Card><CardHeader className="border-b"><CardTitle className="text-base">Contact information</CardTitle></CardHeader><CardContent className="grid gap-3 p-5 sm:grid-cols-2"><Info icon={Mail} label="Primary email" value={contact.email} /><Info icon={Phone} label="Phone number" value={contact.phone} /><Info icon={BriefcaseBusiness} label="Job title" value={contact.title} /><Info icon={MapPin} label="Location" value={contact.work_location} /><Info icon={CalendarDays} label="Stage" value={contact.interest_level || contact.marketing_status} /><Info icon={Linkedin} label="LinkedIn" value={contact.linkedin_url ? "Attached" : "Not attached"} /></CardContent></Card><Card><CardHeader className="border-b"><CardTitle className="text-base">Company overview</CardTitle></CardHeader><CardContent className="p-5"><div className="rounded-2xl border bg-muted/20 p-5"><div className="flex items-center justify-between"><div><p className="font-semibold">{companyName || "No company linked"}</p><p className="mt-1 text-sm text-muted-foreground">{companyName ? "Linked account for this contact." : "Link a company to keep CRM records aligned."}</p></div>{contact.company_id && <Button variant="outline" size="sm" asChild><Link to={`/companies/${contact.company_id}?from=customers`}>Open account</Link></Button>}</div></div></CardContent></Card><LinkedDealsCard contactId={contact.id} companyId={contact.company_id} contactName={name} /></div><div className="space-y-4"><Card><CardHeader><CardTitle className="text-base">Quick actions</CardTitle></CardHeader><CardContent className="flex flex-col gap-2"><Button variant="outline" className="justify-between" disabled={!contact.email} onClick={() => setComposeOpen(true)}>Send email <Mail className="h-4 w-4" /></Button><Button variant="outline" className="justify-between" onClick={() => setActiveTab("activity")}>Open history <Mail className="h-4 w-4" /></Button><Button variant="outline" className="justify-between" onClick={() => setActiveTab("files")}><Sparkles className="h-4 w-4" /> Attach a document</Button></CardContent></Card><Card><CardHeader><CardTitle className="text-base">CRM overview</CardTitle></CardHeader><CardContent className="grid gap-3"><Metric label="Contact stage" value={contact.interest_level || contact.marketing_status || "Lead"} /><Metric label="Time zone" value="Not set" /></CardContent></Card></div></div>
    </div>
    {/* An anchor with a mailto: href handed the click to whatever the OS has
        registered — Apple Mail here — which is not the CRM and doesn't log
        the send. Same composer the inbox uses. */}
    <ComposeEmail
      open={composeOpen}
      onOpenChange={setComposeOpen}
      account={mailbox}
      defaultTo={contact.email ?? ""}
      defaultContactId={contact.id}
    />
  </div>;
}
function Info({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value?: string | null }) { return <div className="rounded-xl border p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><p className="mt-2 text-sm font-medium">{value || "Not available"}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>; }
