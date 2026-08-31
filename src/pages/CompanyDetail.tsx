import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Company } from "@/hooks/useCompanies";
import { OrganisationDetailContent } from "@/components/customers/OrganisationDetailContent";
import { AddContactModal } from "@/components/customers/AddContactModal";

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
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
    <div className="p-6 max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link to="/customers?tab=organisations">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Organisations
        </Link>
      </Button>

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
  );
}
