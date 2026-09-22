import { useState } from "react";
import { Merge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMergeContacts } from "@/hooks/useMergeContacts";
import { toast } from "sonner";
import type { Contact } from "@/hooks/useContacts";

type MergeableContact = Contact & { companies?: { company_name: string } | null };

interface MergeContactsDialogProps {
  contacts: MergeableContact[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
}

function describe(contact: MergeableContact): string {
  const parts = [contact.email, contact.companies?.company_name, contact.phone].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No email, company, or phone on file";
}

export function MergeContactsDialog({ contacts, open, onOpenChange, onMerged }: MergeContactsDialogProps) {
  const [survivorId, setSurvivorId] = useState<string | undefined>(contacts[0]?.id);
  const mergeContacts = useMergeContacts();

  const handleOpenChange = (next: boolean) => {
    if (next) setSurvivorId(contacts[0]?.id);
    onOpenChange(next);
  };

  const handleConfirm = () => {
    if (!survivorId) return;
    const loserIds = contacts.filter((c) => c.id !== survivorId).map((c) => c.id);
    mergeContacts.mutate(
      { survivorId, loserIds },
      {
        onSuccess: (result) => {
          toast.success(
            `Merged ${result.merged_count} duplicate${result.merged_count === 1 ? "" : "s"} into one contact.`,
          );
          onOpenChange(false);
          onMerged();
        },
        onError: (err) => {
          toast.error("Merge failed: " + (err as Error).message);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge {contacts.length} contacts</DialogTitle>
          <DialogDescription>
            Pick the one to keep. Everything else — activities, emails, deals, notes, LMS
            leads — moves onto it, and the rest are deleted. This can't be undone from the UI;
            a snapshot of each deleted contact is kept for support to recover if needed.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={survivorId} onValueChange={setSurvivorId} className="space-y-2 py-2">
          {contacts.map((contact) => {
            const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unnamed";
            return (
              <label
                key={contact.id}
                htmlFor={`merge-survivor-${contact.id}`}
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value={contact.id} id={`merge-survivor-${contact.id}`} className="mt-1" />
                <div className="min-w-0">
                  <p className="font-medium">{fullName}</p>
                  <p className="text-sm text-muted-foreground truncate">{describe(contact)}</p>
                </div>
              </label>
            );
          })}
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mergeContacts.isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!survivorId || mergeContacts.isPending}>
            {mergeContacts.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Merge className="h-4 w-4 mr-1" />
            )}
            Merge into selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
