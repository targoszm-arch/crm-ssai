import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useSequences } from "@/hooks/useSequences";
import { useContacts, useCreateContact } from "@/hooks/useContacts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ExternalLMSCustomer } from "@/hooks/useExternalLMSCustomers";
import { Users, Mail, CheckCircle, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface EnrollAbandonmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUsers: ExternalLMSCustomer[];
  onComplete: () => void;
}

export function EnrollAbandonmentModal({
  open,
  onOpenChange,
  selectedUsers,
  onComplete,
}: EnrollAbandonmentModalProps) {
  const [selectedSequence, setSelectedSequence] = useState<string>("");
  const [createContacts, setCreateContacts] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);

  const { data: sequences } = useSequences();
  const { data: existingContacts } = useContacts();
  const createContact = useCreateContact();
  const queryClient = useQueryClient();

  // Filter for recovery sequences or all active sequences
  const availableSequences = sequences?.filter(
    s => s.status === "active" || s.trigger_type === "signup_abandonment"
  ) || [];

  const handleEnroll = async () => {
    if (!selectedSequence || selectedUsers.length === 0) return;

    setIsEnrolling(true);
    setProgress(0);
    setResults(null);

    let success = 0;
    let failed = 0;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "Please log in to enroll users.",
        variant: "destructive",
      });
      setIsEnrolling(false);
      return;
    }

    for (let i = 0; i < selectedUsers.length; i++) {
      const lmsUser = selectedUsers[i];
      setProgress(((i + 1) / selectedUsers.length) * 100);

      try {
        // Check if contact already exists
        let contactId: string | null = null;
        const existingContact = existingContacts?.find(
          c => c.email?.toLowerCase() === lmsUser.email?.toLowerCase()
        );

        if (existingContact) {
          contactId = existingContact.id;
        } else if (createContacts) {
          // Create new contact
          const nameParts = lmsUser.full_name?.split(" ") || ["Unknown"];
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(" ") || null;

          const { data: newContact, error: contactError } = await supabase
            .from("contacts")
            .insert({
              first_name: firstName,
              last_name: lastName,
              email: lmsUser.email,
              labels: "LMS Abandonment",
              user_id: user.id,
            })
            .select()
            .single();

          if (contactError) throw contactError;
          contactId = newContact.id;
        }

        if (!contactId) {
          failed++;
          continue;
        }

        // Check if already enrolled in this sequence
        const { data: existingEnrollment } = await supabase
          .from("sequence_enrollments")
          .select("id")
          .eq("sequence_id", selectedSequence)
          .eq("contact_id", contactId)
          .maybeSingle();

        if (existingEnrollment) {
          // Already enrolled, skip
          success++;
          continue;
        }

        // Create enrollment
        const { error: enrollError } = await supabase
          .from("sequence_enrollments")
          .insert({
            sequence_id: selectedSequence,
            contact_id: contactId,
            status: "active",
            current_step: 0,
            user_id: user.id,
            metadata: {
              source: "signup_abandonment",
              lms_email: lmsUser.email,
              lms_user_id: lmsUser.id,
              enrolled_at: new Date().toISOString(),
            },
          });

        if (enrollError) throw enrollError;

        // Log activity
        await supabase.from("activities").insert({
          contact_id: contactId,
          activity_type: "recovery_enrollment",
          description: `Enrolled in recovery sequence for signup abandonment`,
          source: "lms_recovery",
          user_id: user.id,
        });

        success++;
      } catch (error) {
        console.error("Failed to enroll user:", lmsUser.email, error);
        failed++;
      }
    }

    setResults({ success, failed });
    setIsEnrolling(false);

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ["sequence-enrollments"] });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["recovery-analytics"] });

    toast({
      title: "Enrollment Complete",
      description: `${success} user${success !== 1 ? "s" : ""} enrolled successfully${failed > 0 ? `, ${failed} failed` : ""}.`,
    });
  };

  const handleClose = () => {
    if (!isEnrolling) {
      setSelectedSequence("");
      setProgress(0);
      setResults(null);
      onOpenChange(false);
      if (results) {
        onComplete();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enroll in Recovery Sequence
          </DialogTitle>
          <DialogDescription>
            Enroll {selectedUsers.length} unverified user{selectedUsers.length !== 1 ? "s" : ""} in a recovery email sequence.
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4 py-4">
            {/* Selected Users Preview */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">
                <strong>{selectedUsers.length}</strong> user{selectedUsers.length !== 1 ? "s" : ""} selected
              </span>
            </div>

            {/* Sequence Selector */}
            <div className="space-y-2">
              <Label>Select Recovery Sequence</Label>
              <Select value={selectedSequence} onValueChange={setSelectedSequence}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a sequence..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSequences.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No active sequences found. Create one first.
                    </div>
                  ) : (
                    availableSequences.map((seq) => (
                      <SelectItem key={seq.id} value={seq.id}>
                        <div className="flex items-center gap-2">
                          <span>{seq.name}</span>
                          {seq.trigger_type === "signup_abandonment" && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              Recovery
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Create Contacts Option */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="createContacts"
                checked={createContacts}
                onCheckedChange={(checked) => setCreateContacts(checked as boolean)}
              />
              <Label htmlFor="createContacts" className="text-sm font-normal cursor-pointer">
                Create CRM contacts for users not in database
              </Label>
            </div>

            {/* Progress */}
            {isEnrolling && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">
                  Enrolling users... {Math.round(progress)}%
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 space-y-4">
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
              <h3 className="font-semibold text-lg">Enrollment Complete</h3>
              <p className="text-muted-foreground">
                {results.success} user{results.success !== 1 ? "s" : ""} enrolled successfully
              </p>
              {results.failed > 0 && (
                <p className="text-destructive flex items-center gap-1 mt-2">
                  <AlertCircle className="h-4 w-4" />
                  {results.failed} failed to enroll
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {!results ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isEnrolling}>
                Cancel
              </Button>
              <Button
                onClick={handleEnroll}
                disabled={!selectedSequence || isEnrolling || selectedUsers.length === 0}
              >
                {isEnrolling ? "Enrolling..." : `Enroll ${selectedUsers.length} User${selectedUsers.length !== 1 ? "s" : ""}`}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
