import { useLMSLeadsByContact, useLMSLeadByEmail, LMSLead } from "@/hooks/useLMSLeads";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  GraduationCap, 
  CheckCircle2, 
  XCircle, 
  Mail, 
  Building2, 
  Target, 
  BookOpen,
  Calendar,
  CreditCard
} from "lucide-react";
import { format } from "date-fns";

interface LMSLeadsTabProps {
  contactId: string;
  contactEmail?: string | null;
}

export function LMSLeadsTab({ contactId, contactEmail }: LMSLeadsTabProps) {
  const { data: leadsByContact, isLoading: isLoadingByContact } = useLMSLeadsByContact(contactId);
  const { data: leadByEmail, isLoading: isLoadingByEmail } = useLMSLeadByEmail(
    leadsByContact?.length === 0 ? contactEmail : null
  );

  const isLoading = isLoadingByContact || isLoadingByEmail;
  
  // Combine results - prefer contact-linked leads, fallback to email match
  const leads = leadsByContact?.length ? leadsByContact : leadByEmail ? [leadByEmail] : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        Loading LMS data...
      </div>
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <GraduationCap className="h-12 w-12 mb-2 opacity-50" />
        <p>No LMS registrations found for this contact</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {leads.map((lead) => (
        <LMSLeadCard key={lead.id} lead={lead} />
      ))}
    </div>
  );
}

function LMSLeadCard({ lead }: { lead: LMSLead }) {
  const creditsPercentage = lead.credits_total > 0 
    ? Math.round((lead.credits_used / lead.credits_total) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            {lead.full_name}
          </CardTitle>
          <div className="flex items-center gap-2">
            {lead.plan && (
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {lead.plan}
              </Badge>
            )}
            {lead.verified ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-600">
                <XCircle className="h-3 w-3 mr-1" />
                Unverified
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credits Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              Credits Used
            </span>
            <span className="font-medium">
              {lead.credits_used} / {lead.credits_total}
            </span>
          </div>
          <Progress value={creditsPercentage} className="h-2" />
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {lead.role && (
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">Role</p>
                <p className="font-medium capitalize">{lead.role}</p>
              </div>
            </div>
          )}

          {lead.company_size && (
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">Company Size</p>
                <p className="font-medium">{lead.company_size}</p>
              </div>
            </div>
          )}

          {lead.use_case && (
            <div className="flex items-start gap-2 col-span-2">
              <Target className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">Use Case</p>
                <p className="font-medium capitalize">{lead.use_case}</p>
              </div>
            </div>
          )}

          {lead.learning_objectives && (
            <div className="flex items-start gap-2 col-span-2">
              <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">Learning Objectives</p>
                <p className="font-medium">{lead.learning_objectives}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            {lead.lms_created_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Registered: {format(new Date(lead.lms_created_at), "MMM d, yyyy")}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              {lead.marketing_consent ? "Opted in" : "Not opted in"}
            </span>
          </div>
          {lead.source && (
            <Badge variant="outline" className="text-xs">
              {lead.source}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
