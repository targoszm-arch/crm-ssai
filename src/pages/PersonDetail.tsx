import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactDetailContent, ContactWithCompany } from "@/components/customers/ContactDetailContent";

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();

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
    <div className="p-6 max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link to="/customers?tab=customers">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Customers
        </Link>
      </Button>

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
  );
}
