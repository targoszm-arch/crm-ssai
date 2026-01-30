import { useMeetingNotes } from "@/hooks/useMeetingNotes";
import { MeetingNoteCard } from "./MeetingNoteCard";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, FileText } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface NotesTabProps {
  contactId: string;
  manualNotes: string;
  isEditing: boolean;
  onNotesChange: (notes: string) => void;
}

export function NotesTab({ contactId, manualNotes, isEditing, onNotesChange }: NotesTabProps) {
  const { data: meetingNotes, isLoading } = useMeetingNotes(contactId);
  const [manualOpen, setManualOpen] = useState(true);
  const [meetingsOpen, setMeetingsOpen] = useState(true);

  return (
    <div className="space-y-4">
      {/* Manual Notes Section */}
      <Collapsible open={manualOpen} onOpenChange={setManualOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between px-2 h-9">
            <span className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Manual Notes
            </span>
            {manualOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {isEditing ? (
            <div>
              <Label htmlFor="manual-notes" className="text-xs text-muted-foreground">
                Personal notes about this contact
              </Label>
              <Textarea
                id="manual-notes"
                value={manualNotes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Add your notes about this contact..."
                rows={4}
                className="mt-1"
              />
            </div>
          ) : manualNotes ? (
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{manualNotes}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic p-3">
              No manual notes. Click edit to add notes.
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Meeting Notes from Fireflies */}
      <Collapsible open={meetingsOpen} onOpenChange={setMeetingsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between px-2 h-9">
            <span className="text-sm font-medium flex items-center gap-2">
              📞 Meeting Notes
              {meetingNotes && meetingNotes.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {meetingNotes.length}
                </span>
              )}
            </span>
            {meetingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : meetingNotes && meetingNotes.length > 0 ? (
            <div className="space-y-3">
              {meetingNotes.map((note) => (
                <MeetingNoteCard key={note.id} note={note} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No meeting notes yet</p>
              <p className="text-xs mt-1">
                Meeting summaries from Fireflies will appear here automatically
              </p>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
