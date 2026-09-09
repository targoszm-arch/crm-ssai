import { useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Company } from "@/hooks/useCompanies";
import { OrganisationDetailContent } from "@/components/customers/OrganisationDetailContent";
import { AddContactModal } from "@/components/customers/AddContactModal";

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const returnTab = searchParams.get("from") === "customers" ? "customers" : "organisations";
  const [addContactOpen, setAddContactOpen] = useState(false);

  const { data: company, isLoading, error } = useQuery({
    queryKey: ["company-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Company;
    },
    enabled: !!id,
  });

  return (
    <div className="min-h-full bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3 text-sm">
            <Button variant="outline" size="icon" asChild aria-label="Back to organisations">
              <Link to={`/customers?tab=${returnTab}`}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <Link className="text-muted-foreground hover:text-foreground" to={`/customers?tab=${returnTab}`}>Organisations</Link>
            <span className="text-muted-foreground">›</span>
            <span className="font-semibold">{company?.company_name || "Organisation"}</span>
          </div>
          {company && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddContactOpen(true)}><Plus className="mr-2 h-4 w-4" />Add person</Button>
              <Button variant="outline" size="sm"><Pencil className="mr-2 h-4 w-4" />Edit company</Button>
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
        <p className="text-sm text-destructive">Couldn't load this company.</p>
      )}

      {company && (
        <OrganisationDetailContent
          company={company}
          onAddContact={() => setAddContactOpen(true)}
        />
      )}

        {company && (
          <AddContactModal
            open={addContactOpen}
            onOpenChange={setAddContactOpen}
            preselectedCompanyId={company.id}
          />
        )}
      </div>
    </div>
  );
}
