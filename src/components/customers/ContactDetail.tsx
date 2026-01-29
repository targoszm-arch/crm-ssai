import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ExternalLink, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Linkedin, 
  Facebook, 
  Instagram,
  TrendingUp,
  Target,
  AlertCircle,
  Star
} from "lucide-react";
import { Contact } from "@/hooks/useContacts";

type ContactWithCompany = Contact & {
  companies?: { company_name: string } | null;
};

interface ContactDetailProps {
  contact: ContactWithCompany | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function ContactDetail({ contact, open, onOpenChange }: ContactDetailProps) {
  if (!contact) return null;

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.name || "Unknown";
  const initials = fullName.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl truncate">{fullName}</SheetTitle>
              {contact.title && (
                <p className="text-sm text-muted-foreground mt-0.5">{contact.title}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {getConnectionStrengthBadge(contact.connection_strength)}
                {contact.interest_level && (
                  <Badge variant="secondary">{contact.interest_level}</Badge>
                )}
                {contact.marketing_status && (
                  <Badge variant="outline">{contact.marketing_status}</Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Information */}
          <div className="space-y-3">
            {contact.companies?.company_name && (
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{contact.companies.company_name}</span>
              </div>
            )}
            {contact.email && (
              <a 
                href={`mailto:${contact.email}`} 
                className="flex items-center gap-3 text-sm text-primary hover:underline"
              >
                <Mail className="h-4 w-4" />
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <a 
                href={`tel:${contact.phone}`} 
                className="flex items-center gap-3 text-sm hover:text-primary"
              >
                <Phone className="h-4 w-4 text-muted-foreground" />
                {contact.phone}
              </a>
            )}
            {contact.work_location && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{contact.work_location}</span>
              </div>
            )}
          </div>

          {/* Social Links */}
          {(contact.linkedin_url || contact.facebook_url || contact.instagram_url) && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">Social Links</h4>
                <div className="flex flex-wrap gap-2">
                  {contact.linkedin_url && (
                    <a
                      href={contact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-md border text-sm hover:bg-accent"
                    >
                      <Linkedin className="h-4 w-4 text-[#0077B5]" />
                      LinkedIn
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {contact.facebook_url && (
                    <a
                      href={contact.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-md border text-sm hover:bg-accent"
                    >
                      <Facebook className="h-4 w-4 text-[#1877F2]" />
                      Facebook
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {contact.instagram_url && (
                    <a
                      href={contact.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-md border text-sm hover:bg-accent"
                    >
                      <Instagram className="h-4 w-4 text-[#E4405F]" />
                      Instagram
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Professional Details */}
          {(contact.function || contact.seniority_level) && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">Professional Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  {contact.function && (
                    <div className="p-3 rounded-lg border bg-card">
                      <p className="text-xs text-muted-foreground mb-1">Function</p>
                      <p className="text-sm font-medium">{contact.function}</p>
                    </div>
                  )}
                  {contact.seniority_level && (
                    <div className="p-3 rounded-lg border bg-card">
                      <p className="text-xs text-muted-foreground mb-1">Seniority</p>
                      <p className="text-sm font-medium">{contact.seniority_level}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* AI Insights */}
          {(contact.buying_signals || contact.pain_point || contact.lqs) && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">AI Insights</h4>
                <div className="space-y-3">
                  {contact.lqs !== null && contact.lqs !== undefined && (
                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <Star className="h-4 w-4 text-yellow-500 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Lead Quality Score</p>
                        <p className="text-lg font-semibold">{contact.lqs}</p>
                      </div>
                    </div>
                  )}
                  {contact.buying_signals && (
                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <TrendingUp className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Buying Signals</p>
                        <p className="text-sm">{contact.buying_signals}</p>
                      </div>
                    </div>
                  )}
                  {contact.pain_point && (
                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Pain Point</p>
                        <p className="text-sm">{contact.pain_point}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Notes & Next Action */}
          {(contact.notes || contact.next_recommended_action) && (
            <>
              <Separator />
              <div className="space-y-4">
                {contact.notes && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Notes</h4>
                    <p className="text-sm text-muted-foreground">{contact.notes}</p>
                  </div>
                )}
                {contact.next_recommended_action && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border bg-primary/5">
                    <Target className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Next Recommended Action</p>
                      <p className="text-sm font-medium">{contact.next_recommended_action}</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Labels */}
          {contact.labels && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Labels</h4>
                <div className="flex flex-wrap gap-2">
                  {contact.labels.split(",").map((label, idx) => (
                    <Badge key={idx} variant="outline">{label.trim()}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
