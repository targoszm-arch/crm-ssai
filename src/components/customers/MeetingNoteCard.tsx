import { useState } from "react";
import { format } from "date-fns";
import { 
  Calendar, 
  Clock, 
  Users, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp,
  FileText,
  Headphones,
  CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MeetingNote } from "@/hooks/useMeetingNotes";

interface MeetingNoteCardProps {
  note: MeetingNote;
}

export function MeetingNoteCard({ note }: MeetingNoteCardProps) {
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const formattedDate = note.meeting_date 
    ? format(new Date(note.meeting_date), "MMMM dd, yyyy 'at' h:mm a")
    : "Unknown date";

  const actionItems = Array.isArray(note.action_items) ? note.action_items : [];

  return (
    <div className="p-4 rounded-lg border bg-card space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{note.title}</h4>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formattedDate}
            </span>
            {note.duration_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {note.duration_minutes} min
              </span>
            )}
          </div>
        </div>
        {note.meeting_type && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {note.meeting_type}
          </Badge>
        )}
      </div>

      {/* Participants */}
      {note.participants && note.participants.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Users className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="line-clamp-2">{note.participants.join(", ")}</span>
        </div>
      )}

      {/* Summary/Gist */}
      {note.summary && (
        <p className="text-sm text-muted-foreground">{note.summary}</p>
      )}

      {/* Overview - Collapsible */}
      {note.overview && (
        <Collapsible open={overviewOpen} onOpenChange={setOverviewOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between px-2 h-8">
              <span className="text-xs font-medium">Overview</span>
              {overviewOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-md">
              {note.overview}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Action Items - Collapsible */}
      {actionItems.length > 0 && (
        <Collapsible open={actionsOpen} onOpenChange={setActionsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between px-2 h-8">
              <span className="text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3" />
                Action Items ({actionItems.length})
              </span>
              {actionsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <ul className="space-y-2">
              {actionItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-primary font-medium">•</span>
                  <span className="text-muted-foreground">
                    {typeof item === "string" ? item : item.text}
                    {item.assignee && (
                      <span className="text-xs text-primary ml-1">({item.assignee})</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Bullet Gist */}
      {note.bullet_gist && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start px-2 h-8 text-xs text-muted-foreground">
              <ChevronDown className="h-3 w-3 mr-1" />
              Bullet Summary
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-md">
              {note.bullet_gist}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Links */}
      <div className="flex items-center gap-2 pt-2 border-t">
        {note.transcript_url && (
          <a
            href={note.transcript_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <FileText className="h-3 w-3" />
            Transcript
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
        {note.audio_url && (
          <a
            href={note.audio_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Headphones className="h-3 w-3" />
            Audio
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}
