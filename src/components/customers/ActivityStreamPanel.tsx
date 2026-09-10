import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  StickyNote, CalendarDays, Mail, Phone, Linkedin, Receipt, Circle,
  Loader2, Trash2, Send, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  useActivityStream, useAutomationCount, useAddNote, useDeleteNote,
  type ActivityKind, type StreamScope,
} from "@/hooks/useActivityStream";

/**
 * The client history for one person or company, with somewhere to write to it.
 *
 * A stream rather than a single notes field, because a relationship is a
 * sequence of things that happened on particular days — one box you overwrite
 * loses the history the CRM exists to keep.
 */

const ICONS: Record<ActivityKind, typeof StickyNote> = {
  note: StickyNote,
  meeting: CalendarDays,
  email: Mail,
  call: Phone,
  linkedin: Linkedin,
  invoice: Receipt,
  other: Circle,
};

const LABELS: Record<ActivityKind, string> = {
  note: "Note",
  meeting: "Meeting",
  email: "Email",
  call: "Call",
  linkedin: "LinkedIn",
  invoice: "Invoice",
  other: "Activity",
};

interface ActivityStreamPanelProps {
  scope: StreamScope;
  /** Company view names the person each row came from; the person view need not. */
  showPerson?: boolean;
  /**
   * Opens the email an activity row describes. Without it those rows stay
   * plain text — which was the complaint.
   */
  onOpenEmail?: (emailId: string) => void;
}

export function ActivityStreamPanel({
  scope, showPerson = false, onOpenEmail,
}: ActivityStreamPanelProps) {
  const [draft, setDraft] = useState("");
  const [includeAutomation, setIncludeAutomation] = useState(false);

  const { data: items, isLoading } = useActivityStream(scope, includeAutomation);
  const { data: automationCount = 0 } = useAutomationCount(scope);
  const addNote = useAddNote();
  const deleteNote = useDeleteNote();

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    addNote.mutate(
      { scope, text },
      {
        onSuccess: () => setDraft(""),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Could not save the note"),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note — what was said, what was agreed, what happens next."
            rows={3}
            // Ctrl/Cmd+Enter, so a note can span lines without Enter sending it.
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Timestamped when you save it. ⌘/Ctrl + Enter.
            </span>
            <Button size="sm" onClick={submit} disabled={!draft.trim() || addNote.isPending}>
              {addNote.isPending
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Send className="mr-1.5 h-3.5 w-3.5" />}
              Add note
            </Button>
          </div>
        </CardContent>
      </Card>

      {automationCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <span>
            {automationCount.toLocaleString()} LinkedIn automation event
            {automationCount === 1 ? "" : "s"} hidden
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setIncludeAutomation((v) => !v)}
          >
            {includeAutomation ? "Hide them" : "Show them"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
        </div>
      ) : !items?.length ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center">
          <StickyNote className="mx-auto size-8 text-muted-foreground/60" />
          <h3 className="mt-3 font-medium">Nothing recorded yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Notes, meetings and emails will appear here in order.
          </p>
        </div>
      ) : (
        <ol className="relative space-y-4 border-l pl-6">
          {items.map((item) => {
            const Icon = ICONS[item.kind];
            const when = new Date(item.at);
            return (
              <li key={item.id} className="group relative">
                <span className="absolute -left-[31px] flex size-6 items-center justify-center rounded-full border bg-background">
                  <Icon className="size-3" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[11px]">{LABELS[item.kind]}</Badge>
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={when.toISOString()}
                    title={format(when, "d MMM yyyy, HH:mm")}
                  >
                    {format(when, "d MMM yyyy, HH:mm")} · {formatDistanceToNow(when, { addSuffix: true })}
                  </time>
                  {showPerson && item.personName && (
                    <span className="text-xs text-muted-foreground">· {item.personName}</span>
                  )}
                  {item.editable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Delete note"
                      onClick={() => deleteNote.mutate(item.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
                {item.body && (
                  item.emailId && onOpenEmail ? (
                    <button
                      className="mt-1 block w-full text-left"
                      onClick={() => onOpenEmail(item.emailId!)}
                    >
                      <span className="whitespace-pre-wrap text-sm group-hover:text-primary group-hover:underline">
                        {item.body}
                      </span>
                      <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <ExternalLink className="size-3" /> Open this email
                      </span>
                    </button>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm">{item.body}</p>
                  )
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
