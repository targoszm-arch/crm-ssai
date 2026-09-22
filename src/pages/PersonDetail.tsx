import { useState } from "react";
import PageShell from "@/components/layout/PageShell";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactDetailContent, ContactWithCompany } from "@/components/customers/ContactDetailContent";
import { ComposeEmail } from "@/components/inbox/ComposeEmail";
import { HistoryPanel } from "@/components/customers/HistoryPanel";
import { useEmailAccounts } from "@/hooks/useEmailAccounts";

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const returnTab = searchParams.get("from") === "organisations" ? "organisations" : "customers";
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
  const companyName = contact.companies?.company_name;

  return <div>
    <PageShell>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3 text-sm"><Button variant="outline" size="icon" asChild><Link to={`/customers?tab=${returnTab}`} aria-label="Back to people"><ArrowLeft className="h-4 w-4" /></Link></Button><Link className="text-muted-foreground hover:text-foreground" to={`/customers?tab=${returnTab}`}>People</Link><span className="text-muted-foreground">›</span><strong>{name}</strong></div>
        <div className="flex gap-2"><Button variant="outline" size="sm" disabled={!contact.email} onClick={() => setComposeOpen(true)}><Mail className="mr-2 h-4 w-4" />Send email</Button>{companyName && contact.company_id && <Button variant="outline" size="sm" asChild><Link to={`/companies/${contact.company_id}?from=customers`}><Building2 className="mr-2 h-4 w-4" />Open company</Link></Button>}</div>
      </header>
      {/* The name/avatar/badges card that used to live here duplicated
          ContactDetailContent's own header below it — same name, same avatar,
          twice on one page. ContactDetailContent's is the more complete one
          (it also carries Create Deal, Enrich and Edit), so it's the only one
          now. Same reasoning removed the separate Overview/Activity/Files page
          tabs: ContactHistoryTabs below already covers activity and files as
          tabs of its own — a second tab strip for the same page was the
          "why two separate tabs" complaint, not two different concerns. */}
      <div className="mt-6">
        <ContactDetailContent
          contact={contact}
          onRefetched={refetch}
          onOpenEmail={(emailId) => { setHistoryEmailId(emailId); setHistoryOpen(true); }}
        />
      </div>
    </PageShell>
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
