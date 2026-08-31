import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { ContactDetailContent, ContactWithCompany } from "./ContactDetailContent";

interface ContactDetailProps {
  contact: ContactWithCompany | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDetail({ contact, open, onOpenChange }: ContactDetailProps) {
  if (!contact) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="sr-only">
          <SheetTitle>{contact.name || "Contact details"}</SheetTitle>
        </SheetHeader>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/people/${contact.id}`} onClick={() => onOpenChange(false)}>
              Open full page
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
        <div className="mt-4">
          <ContactDetailContent contact={contact} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
