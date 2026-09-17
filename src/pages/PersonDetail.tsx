import { useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Mail, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactDetailContent, ContactWithCompany } from "@/components/customers/ContactDetailContent";
import { ActivityStreamPanel } from "@/components/customers/ActivityStreamPanel";
import { FilesPanel } from "@/components/customers/FilesPanel";
import { ComposeEmail } from "@/components/inbox/ComposeEmail";
import { HistoryPanel } from "@/components/customers/HistoryPanel";
import { useEmailAccounts } from "@/hooks/useEmailAccounts";

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const returnTab = searchParams.get("from") === "organisations" ? "organisations" : "customers";
  const [activeTab, setActiveTab] = useState("overview");
  const [composeOpen, setComposeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEmailId, setHistoryEmailId] = useState<string | null>(null);
  const { data: accounts } = useEmailAccounts();
  const mailbox = accounts?.[0] ?? null;
  const { data: contact, isLoading, error, refetch } = useQuery({
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
      {activeTab === "activity" && <div className="max-w-4xl"><ActivityStreamPanel scope={{ contactId: contact.id, companyId: contact.company_id }} onOpenEmail={(emailId) => { setHistoryEmailId(emailId); setHistoryOpen(true); }} /></div>}
      {activeTab === "files" && <div className="max-w-4xl"><FilesPanel scope={{ contactId: contact.id, companyId: contact.company_id }} /></div>}
      <div hidden={activeTab !== "overview"} className="max-w-4xl"><ContactDetailContent contact={contact} onRefetched={refetch} /></div>
    </div>
    {/* An anchor with a mailto: href handed the click to whatever the OS has
        registered — Apple Mail here — which is not the CRM and doesn't log
        the send. Same composer the inbox uses. */}
    <HistoryPanel
      open={historyOpen}
      onOpenChange={(next) => {
        setHistoryOpen(next);
        if (!next) setHistoryEmailId(null);
      }}
      contactId={contact.id}
      name={name}
      initialEmailId={historyEmailId}
    />
    <ComposeEmail
      open={composeOpen}
      onOpenChange={setComposeOpen}
      account={mailbox}
      defaultTo={contact.email ?? ""}
      defaultContactId={contact.id}
    />
  </div>;
}
