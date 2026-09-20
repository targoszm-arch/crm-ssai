import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSequences, useEnrollContacts } from "@/hooks/useSequences";

interface EnrollListMenuProps {
  contactIds: string[];
  disabled?: boolean;
}

export function EnrollListMenu({ contactIds, disabled }: EnrollListMenuProps) {
  // Only active sequences — enrolling into one of the 59 drafts would sit there
  // with nothing to ever send it (see CLAUDE.md's sequence-engine caveat).
  const { data: sequences, isLoading } = useSequences("active");
  const enrollContacts = useEnrollContacts();

  const handleEnroll = (sequenceId: string) => {
    enrollContacts.mutate({ sequenceId, contactIds });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || contactIds.length === 0}>
          {enrollContacts.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-1" />
          )}
          Enroll in sequence
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          Enroll {contactIds.length} contact{contactIds.length === 1 ? "" : "s"} in…
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <DropdownMenuItem disabled>Loading sequences…</DropdownMenuItem>
        ) : sequences && sequences.length > 0 ? (
          sequences.map((sequence) => (
            <DropdownMenuItem key={sequence.id} onSelect={() => handleEnroll(sequence.id)}>
              <span className="truncate">{sequence.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {sequence.steps.length} email{sequence.steps.length === 1 ? "" : "s"}
              </span>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>No active sequences</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
