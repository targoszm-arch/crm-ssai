import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { MapPin, Video, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: {
    id: string;
    title: string;
    description?: string | null;
    location?: string | null;
    start_time: string;
    end_time: string;
    all_day?: boolean;
    meeting_link?: string | null;
    status?: string;
    attendees?: string[] | null;
    contacts?: { first_name: string; last_name?: string | null; email?: string | null } | null;
    companies?: { company_name: string } | null;
  };
  onClick?: () => void;
  compact?: boolean;
}

export function EventCard({ event, onClick, compact = false }: EventCardProps) {
  const startTime = new Date(event.start_time);
  const endTime = new Date(event.end_time);

  const formatTime = (date: Date) => format(date, "h:mm a");

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          "text-xs p-1 rounded bg-primary/10 text-primary truncate cursor-pointer hover:bg-primary/20 transition-colors",
          event.status === "cancelled" && "line-through opacity-50"
        )}
        title={event.title}
      >
        {event.all_day ? "All day" : formatTime(startTime)} - {event.title}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer",
        event.status === "cancelled" && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className={cn(
            "font-medium text-sm truncate",
            event.status === "cancelled" && "line-through"
          )}>
            {event.title}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            {event.all_day
              ? "All day"
              : `${formatTime(startTime)} - ${formatTime(endTime)}`}
          </p>
        </div>
        {event.status === "tentative" && (
          <Badge variant="outline" className="text-xs shrink-0">
            Tentative
          </Badge>
        )}
      </div>

      {(event.location || event.meeting_link) && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          {event.meeting_link ? (
            <a
              href={event.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <Video className="h-3 w-3" />
              Join Meeting
            </a>
          ) : event.location ? (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              {event.location}
            </span>
          ) : null}
        </div>
      )}

      {(event.contacts || event.companies) && (
        <div className="flex flex-wrap gap-1 mt-2">
          {event.contacts && (
            <Badge variant="secondary" className="text-xs gap-1">
              <User className="h-3 w-3" />
              {event.contacts.first_name} {event.contacts.last_name || ""}
            </Badge>
          )}
          {event.companies && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Building2 className="h-3 w-3" />
              {event.companies.company_name}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
