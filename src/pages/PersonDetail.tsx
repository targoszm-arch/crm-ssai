import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Building2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactDetailContent, ContactWithCompany } from "@/components/customers/ContactDetailContent";

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const returnTab = searchParams.get("from") === "organisations" ? "organisations" : "customers";

  const { data: contact, isLoading, error } = useQuery({
    queryKey: ["contact-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies!contacts_company_id_fkey(company_name)")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as ContactWithCompany;
    },
    enabled: !!id,
  });

  return (
    <div className="min-h-full bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3 text-sm">
            <Button variant="outline" size="icon" asChild aria-label="Back to people">
              <Link to={`/customers?tab=${returnTab}`}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <Link className="text-muted-foreground hover:text-foreground" to={`/customers?tab=${returnTab}`}>People</Link>
            <span className="text-muted-foreground">›</span>
            <span className="font-semibold">{contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.name : "Person"}</span>
          </div>
          {contact && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm"><Mail className="mr-2 h-4 w-4" />Send email</Button>
              {contact.company_id && <Button variant="outline" size="sm"><Building2 className="mr-2 h-4 w-4" />Open company</Button>}
              <Button size="sm"><Sparkles className="mr-2 h-4 w-4" />Add to pipeline</Button>
            </div>
          )}
        </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">Couldn't load this contact.</p>
      )}

        {contact && <ContactDetailContent contact={contact} />}
      </div>
    </div>
  );
}
