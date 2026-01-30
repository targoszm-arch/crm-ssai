import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Star,
  Pencil,
  Save,
  X,
  Sparkles,
  Loader2,
  Lightbulb,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Contact, useUpdateContact } from "@/hooks/useContacts";
import { enrichContact } from "@/lib/api/enrichment";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContactHistoryTabs } from "./ContactHistoryTabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EditableLabels } from "./EditableLabels";

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

export function ContactDetail({ contact: initialContact, open, onOpenChange }: ContactDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    title: "",
    work_location: "",
    linkedin_url: "",
    facebook_url: "",
    instagram_url: "",
    notes: "",
  });

  const updateContact = useUpdateContact();
  const queryClient = useQueryClient();

  // Fetch fresh contact data when drawer is open
  const { data: freshContact, refetch } = useQuery({
    queryKey: ["contact-detail", initialContact?.id],
    queryFn: async () => {
      if (!initialContact?.id) return null;
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies!contacts_company_id_fkey(company_name)")
        .eq("id", initialContact.id)
        .single();
      
      if (error) throw error;
      return data as ContactWithCompany;
    },
    enabled: open && !!initialContact?.id,
    staleTime: 0, // Always fetch fresh data
  });

  // Use fresh data if available, otherwise fall back to initial contact
  const contact = freshContact || initialContact;

  useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        title: contact.title || "",
        work_location: contact.work_location || "",
        linkedin_url: contact.linkedin_url || "",
        facebook_url: contact.facebook_url || "",
        instagram_url: contact.instagram_url || "",
        notes: contact.notes || "",
      });
    }
  }, [contact]);

  useEffect(() => {
    if (!open) {
      setIsEditing(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (!contact) return;

    try {
      await updateContact.mutateAsync({
        id: contact.id,
        ...formData,
      });
      toast({
        title: "Contact updated",
        description: "The contact details have been saved successfully.",
      });
      setIsEditing(false);
      refetch(); // Refresh the contact data
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update contact. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        title: contact.title || "",
        work_location: contact.work_location || "",
        linkedin_url: contact.linkedin_url || "",
        facebook_url: contact.facebook_url || "",
        instagram_url: contact.instagram_url || "",
        notes: contact.notes || "",
      });
    }
    setIsEditing(false);
  };

  const handleEnrich = async () => {
    if (!contact) return;

    setIsEnriching(true);
    try {
      const result = await enrichContact(contact.id);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["company-contacts"] });
      
      // Refetch this specific contact to show updated data immediately
      await refetch();
      
      toast({
        title: "Contact Enriched",
        description: result.enrichedFields.length > 0 
          ? `Updated: ${result.enrichedFields.join(", ")}`
          : result.message || "No new data found. Try adding email or LinkedIn for better results.",
      });
    } catch (error) {
      toast({
        title: "Enrichment Failed",
        description: error instanceof Error ? error.message : "Failed to enrich contact",
        variant: "destructive",
      });
    } finally {
      setIsEnriching(false);
    }
  };

  if (!contact) return null;

  const fullName = [formData.first_name, formData.last_name].filter(Boolean).join(" ") || contact.name || "Unknown";
  const initials = fullName.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();

  // Check if AI insights are available
  const hasAiInsights = contact.buying_signals || contact.pain_point || contact.lqs || contact.interest_level || contact.next_recommended_action;
  const hasProfessionalDetails = contact.function || contact.seniority_level;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="first_name" className="text-xs">First Name</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name" className="text-xs">Last Name</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Last name"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="title" className="text-xs">Job Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Job title"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <SheetTitle className="text-xl truncate">{fullName}</SheetTitle>
                  {contact.title && (
                    <p className="text-sm text-muted-foreground mt-0.5">{contact.title}</p>
                  )}
                </>
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
            {!isEditing ? (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleEnrich}
                  disabled={isEnriching}
                  title="Enrich with AI"
                >
                  {isEnriching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleSave} disabled={updateContact.isPending}>
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            )}
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
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Email address"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-xs">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="work_location" className="text-xs">Location</Label>
                  <Input
                    id="work_location"
                    value={formData.work_location}
                    onChange={(e) => setFormData({ ...formData, work_location: e.target.value })}
                    placeholder="Work location"
                  />
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* Social Links */}
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-3">Social Links</h4>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="linkedin_url" className="text-xs">LinkedIn URL</Label>
                    <Input
                      id="linkedin_url"
                      value={formData.linkedin_url}
                      onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="facebook_url" className="text-xs">Facebook URL</Label>
                    <Input
                      id="facebook_url"
                      value={formData.facebook_url}
                      onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="instagram_url" className="text-xs">Instagram URL</Label>
                    <Input
                      id="instagram_url"
                      value={formData.instagram_url}
                      onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                </div>
              ) : (contact.linkedin_url || contact.facebook_url || contact.instagram_url) ? (
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
              ) : (
                <p className="text-sm text-muted-foreground">No social links added</p>
              )}
            </div>
          </>

          {/* Labels Section */}
          <Separator />
          <EditableLabels
            labels={contact.labels}
            onSave={async (labels) => {
              await updateContact.mutateAsync({ id: contact.id, labels });
              refetch();
              toast({
                title: "Labels updated",
                description: "Contact labels have been saved.",
              });
            }}
            isLoading={updateContact.isPending}
          />

          {/* Professional Details - Always show section */}
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-3">Professional Details</h4>
            {hasProfessionalDetails ? (
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
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed bg-muted/30 text-muted-foreground">
                <Lightbulb className="h-4 w-4" />
                <p className="text-sm">Click <Sparkles className="h-3 w-3 inline mx-1" /> to enrich with AI</p>
              </div>
            )}
          </div>

          {/* AI Insights - Always show section */}
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-3">AI Insights</h4>
            {hasAiInsights ? (
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
                {contact.interest_level && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <Target className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Interest Level</p>
                      <p className="text-sm font-medium">{contact.interest_level}</p>
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
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed bg-muted/30 text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <p className="text-sm">No AI insights yet. Click the sparkle icon to enrich.</p>
              </div>
            )}
          </div>

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

          {/* Save/Cancel buttons at bottom when editing */}
          {isEditing && (
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={handleCancel}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={updateContact.isPending}>
                {updateContact.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}

          {/* History Tabs Section */}
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-4">History</h4>
            <ContactHistoryTabs 
              contact={contact}
              manualNotes={formData.notes}
              isEditing={isEditing}
              onNotesChange={(notes) => setFormData({ ...formData, notes })}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
