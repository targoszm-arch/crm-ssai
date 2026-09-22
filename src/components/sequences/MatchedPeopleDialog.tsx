import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, UserPlus, Loader2, CircleCheck } from "lucide-react";
import { useContactsByIds, useEnrollmentStatus, useBackfillRouteEnrollment } from "@/hooks/useRouteMatches";

interface MatchedPeopleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeId: string;
  topic: string;
  label: string;
  contactIds: string[];
  sequenceId: string | null;
  sequenceName: string | null;
  onEditRule: () => void;
}

/**
 * What "1 person matched" turns into when you click it: who they are, a way to open their
 * actual profile, and — once the rule has a sequence — a way to put them in it. A rule
 * that matched people before it had a sequence attached (or still doesn't have one) is the
 * normal case, not an edge case, so this is the retargeting step, not just a viewer.
 */
export function MatchedPeopleDialog({
  open, onOpenChange, routeId, topic, label, contactIds, sequenceId, sequenceName, onEditRule,
}: MatchedPeopleDialogProps) {
  const { data: contacts, isLoading } = useContactsByIds(contactIds);
  const { data: enrolledIds } = useEnrollmentStatus(contactIds, sequenceId);
  const backfill = useBackfillRouteEnrollment();

  const notYetEnrolled = contactIds.filter((id) => !enrolledIds?.has(id));

  const enrol = (ids: string[]) => {
    if (!sequenceId) return;
    backfill.mutate({ contactIds: ids, sequenceId, routeId, topic, label });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Matched "{label}"</DialogTitle>
          <DialogDescription>
            {contactIds.length} {contactIds.length === 1 ? "person has" : "people have"} matched
            this rule.
          </DialogDescription>
        </DialogHeader>

        {!sequenceId && (
          <div className="rounded-lg border bg-muted/50 p-3 text-sm">
            This rule is label only — there's no sequence to put these people in yet.{" "}
            <Button variant="link" className="h-auto p-0" onClick={onEditRule}>
              Edit the rule to add one
            </Button>
            .
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : !contacts?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nobody found — they may have been merged or deleted since matching.
            </p>
          ) : (
            contacts.map((contact) => {
              const name =
                [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
                contact.email ||
                "Unnamed contact";
              const isEnrolled = enrolledIds?.has(contact.id);
              return (
                <div
                  key={contact.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/people/${contact.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline inline-flex items-center gap-1"
                    >
                      {name}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                    {contact.email && (
                      <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                    )}
                  </div>
                  {sequenceId && (
                    isEnrolled ? (
                      <Badge variant="secondary" className="gap-1 shrink-0">
                        <CircleCheck className="h-3 w-3" />
                        Enrolled
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={backfill.isPending}
                        onClick={() => enrol([contact.id])}
                      >
                        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                        Enrol
                      </Button>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>

        {sequenceId && (
          <DialogFooter className="sm:justify-between items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Into <span className="font-medium">{sequenceName}</span>
            </p>
            <Button
              onClick={() => enrol(notYetEnrolled)}
              disabled={backfill.isPending || notYetEnrolled.length === 0}
            >
              {backfill.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enrol all matched ({notYetEnrolled.length})
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
