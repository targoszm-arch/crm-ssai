import { useEffect, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Loader2, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { EmailThread } from "@/components/inbox/EmailThread";
import { useEmailHistory, useEmail, type Email } from "@/hooks/useEmails";
import { useEmailAccounts } from "@/hooks/useEmailAccounts";

/**
 * The person's email history, beside their record rather than instead of it.
 *
 * "Open history" used to swap the page's tab, so reading an email meant losing
 * sight of who it was from. This is a side panel: the contact stays on screen,
 * and the breadcrumb goes back to the list without closing anything.
 *
 * Deliberately not a Sheet: that renders a bg-black/80 overlay and its own
 * close button, and an overlay dimming the contact would undo the point of
 * showing them at the same time.
 */

interface HistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One or the other: a person's mail, or a company's. */
  contactId?: string | null;
  companyId?: string | null;
  /** Whose history it is, for the breadcrumb and the empty state. */
  name: string;
  /** Opens straight onto one message, e.g. from an activity row. */
  initialEmailId?: string | null;
}

export function HistoryPanel({
  open, onOpenChange, contactId, companyId, name, initialEmailId,
}: HistoryPanelProps) {
  const [selected, setSelected] = useState<Email | null>(null);

  const { data: emails, isLoading } = useEmailHistory(
    open ? { contactId, companyId } : {},
  );
  const { data: deepLinked } = useEmail(open ? initialEmailId : null);
  const { data: accounts } = useEmailAccounts();
  const mailbox = accounts?.[0] ?? null;

  // Opening on a specific message, and clearing the selection when the panel is
  // dismissed so reopening it lands on the list rather than the last email read.
  useEffect(() => {
    if (!open) setSelected(null);
    else if (deepLinked) setSelected(deepLinked);
  }, [open, deepLinked]);

  // Escape closes it, which a dialog would have given us for free.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <aside
      role="dialog"
      aria-label={`Email history for ${name}`}
      // Below the header rather than over it, so the top bar's own actions stay
      // reachable while the panel is open.
      className="fixed bottom-0 right-0 top-14 z-40 flex w-full flex-col border-l bg-background shadow-xl sm:w-[560px]"
    >
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {selected ? (
                <BreadcrumbLink asChild>
                  <button onClick={() => setSelected(null)}>{name}</button>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{name}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {selected ? (
                <BreadcrumbLink asChild>
                  <button onClick={() => setSelected(null)}>History</button>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>History</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {selected && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="block max-w-[220px] truncate">
                    {selected.subject || "(No subject)"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Close history"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {selected ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmailThread email={selected} account={mailbox} onClose={() => setSelected(null)} />
        </div>
      ) : isLoading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
        </div>
      ) : !emails?.length ? (
        <div className="p-8 text-center">
          <Mail className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">
            No email linked to {name} yet.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 divide-y overflow-y-auto">
          {emails.map((email) => (
            <button
              key={email.id}
              className="block w-full px-5 py-3 text-left hover:bg-muted/40"
              onClick={() => setSelected(email)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {email.direction === "inbound"
                    ? email.from_name || email.from_email
                    : `To: ${email.to_emails?.[0] || "Unknown"}`}
                </span>
                <span
                  className="shrink-0 text-xs text-muted-foreground"
                  title={format(new Date(email.received_at), "d MMM yyyy, HH:mm")}
                >
                  {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                </span>
              </div>
              <p className="truncate text-sm">{email.subject || "(No subject)"}</p>
              <p className="truncate text-xs text-muted-foreground">{email.snippet}</p>
              {email.direction === "outbound" && (
                <Badge variant="outline" className="mt-1.5 py-0 text-xs">Sent</Badge>
              )}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
