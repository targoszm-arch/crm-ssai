import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, UserPlus, Mail, Phone, MapPin, Calendar, Building2, Users } from "lucide-react";
import { format } from "date-fns";
import { useContactsByCompany } from "@/hooks/useContacts";
import { Company } from "@/hooks/useCompanies";
import { Skeleton } from "@/components/ui/skeleton";

interface OrganisationDetailProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddContact: (companyId: string) => void;
}

function getConnectionStrengthBadge(strength: string | null) {
  if (!strength) return null;
  
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
    "Very strong": { variant: "default", className: "bg-green-500 hover:bg-green-600" },
    "Strong": { variant: "default", className: "bg-green-400 hover:bg-green-500" },
    "Good": { variant: "secondary", className: "bg-blue-500 text-white hover:bg-blue-600" },
    "Weak": { variant: "secondary", className: "bg-yellow-500 text-white hover:bg-yellow-600" },
    "Very weak": { variant: "outline", className: "border-muted-foreground/50" },
  };

  const config = variants[strength] || variants["Very weak"];
  
  return (
    <Badge variant={config.variant} className={config.className}>
      {strength}
    </Badge>
  );
}

export function OrganisationDetail({ company, open, onOpenChange, onAddContact }: OrganisationDetailProps) {
  const { data: contacts, isLoading: contactsLoading } = useContactsByCompany(company?.id || null);

  if (!company) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
              {company.company_name?.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl truncate">{company.company_name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                {getConnectionStrengthBadge(company.connection_strength)}
                {company.industry && (
                  <Badge variant="outline">{company.industry}</Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Company Details */}
          <div className="space-y-3">
            {company.domains && (
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{company.domains}</span>
              </div>
            )}
            {company.country && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{company.country}</span>
              </div>
            )}
            {company.employee_range && (
              <div className="flex items-center gap-3 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{company.employee_range} employees</span>
              </div>
            )}
            {company.last_interaction && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Last interaction: {format(new Date(company.last_interaction), "MMM d, yyyy")}</span>
              </div>
            )}
            {company.linkedin_url && (
              <a
                href={company.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                View on LinkedIn
              </a>
            )}
          </div>

          {company.description && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{company.description}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Contacts Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium">Contacts ({contacts?.length || 0})</h4>
              <Button size="sm" variant="outline" onClick={() => onAddContact(company.id)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Add Contact
              </Button>
            </div>

            {contactsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : contacts && contacts.length > 0 ? (
              <div className="space-y-3">
                {contacts.map((contact) => {
                  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
                  const initials = fullName.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
                  
                  return (
                    <div key={contact.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{fullName}</div>
                        {contact.title && (
                          <div className="text-sm text-muted-foreground truncate">{contact.title}</div>
                        )}
                        <div className="flex flex-wrap gap-3 mt-1">
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </a>
                          )}
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No contacts yet</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-3"
                  onClick={() => onAddContact(company.id)}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add First Contact
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}