import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Contact } from "@/hooks/useContacts";
import { useLeadQualification } from "@/hooks/useLeadQualifications";
import { LeadQualificationModal } from "./LeadQualificationModal";

/**
 * First entry in the People right column (Magda, 22 Sep 2026). Empty state
 * is just the "Create Lead qualification form" button; once one exists the
 * button is replaced by this same card acting as a trigger that opens the
 * (always-editable) modal — the full form never lives inline in the card.
 * A deal can't be created for this contact until the form is marked
 * complete here (enforced in the database, not just in this UI).
 */
export function LeadQualificationCard({ contact }: { contact: Contact }) {
  const { data: qualification, isLoading } = useLeadQualification(contact.id);
  const [modalOpen, setModalOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-5 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-5">
          {qualification ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="flex items-center gap-3">
                <ClipboardCheck className={qualification.status === "completed" ? "h-5 w-5 text-green-600" : "h-5 w-5 text-muted-foreground"} />
                <div>
                  <p className="text-sm font-medium">Lead Qualification</p>
                  <p className="text-xs text-muted-foreground">
                    {qualification.status === "completed" && qualification.completed_at
                      ? `Completed ${format(new Date(qualification.completed_at), "dd/MM/yyyy")}`
                      : `Last saved ${format(new Date(qualification.updated_at), "dd/MM/yyyy")}`}
                  </p>
                </div>
              </div>
              <Badge variant={qualification.status === "completed" ? "default" : "secondary"}>
                {qualification.status === "completed" ? "Completed" : "Draft"}
              </Badge>
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Lead Qualification</p>
                <p className="text-xs text-muted-foreground">Required before a deal can be created</p>
              </div>
              <Button size="sm" onClick={() => setModalOpen(true)}>Create Lead qualification form</Button>
            </div>
          )}
        </CardContent>
      </Card>
      <LeadQualificationModal open={modalOpen} onOpenChange={setModalOpen} contact={contact} />
    </>
  );
}
