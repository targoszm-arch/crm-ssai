import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Company } from "@/hooks/useCompanies";
import { OrganisationDetailContent } from "./OrganisationDetailContent";

interface OrganisationDetailProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddContact: (companyId: string) => void;
}

export function OrganisationDetail({ company, open, onOpenChange, onAddContact }: OrganisationDetailProps) {
  if (!company) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="sr-only">
          <SheetTitle>{company.company_name || "Company details"}</SheetTitle>
        </SheetHeader>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/companies/${company.id}`} onClick={() => onOpenChange(false)}>
              Open full page
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
        <div className="mt-4">
          <OrganisationDetailContent company={company} onAddContact={onAddContact} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
