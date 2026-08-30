import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Calendar, CheckSquare, Loader2, Linkedin, MessageSquare, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useActivities } from "@/hooks/useActivities";

interface ActivitiesTabProps {
  contactId: string;
}

export function ActivitiesTab({ contactId }: ActivitiesTabProps) {
  // Fetch tasks linked to this contact
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["contact-tasks", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!contactId,
  });

  // Fetch calendar events linked to this contact
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["contact-events", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("contact_id", contactId)
        .order("start_time", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!contactId,
  });

  // The activities table is where every Meet Alfred / LinkedIn touch lands — 62k rows of
  // connections, replies and leads, all already linked to a contact. This tab used to read
  // only tasks and calendar_events, so it showed "No activities yet" on contacts that had
  // hundreds of recorded touches.
  const { data: timeline, isLoading: timelineLoading } = useActivities(contactId);

  const isLoading = tasksLoading || eventsLoading || timelineLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasActivities =
    (tasks && tasks.length > 0) ||
    (events && events.length > 0) ||
    (timeline && timeline.length > 0);

  if (!hasActivities) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No activities yet</p>
        <p className="text-xs mt-1">
          LinkedIn touches, tasks and calendar events linked to this contact will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* LinkedIn / Meet Alfred timeline */}
      {timeline && timeline.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            LinkedIn ({timeline.length}
            {timeline.length === 50 ? "+" : ""})
          </h5>
          {timeline.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              {activityIcon(activity.activity_type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{activityLabel(activity.activity_type)}</p>
                {activity.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">
                    {activity.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(activity.occurred_at), "MMM dd, yyyy 'at' h:mm a")}
                </p>
              </div>
              {activity.source && (
                <Badge variant="outline" className="text-xs shrink-0">
                  {activity.source}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tasks */}
      {tasks && tasks.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasks</h5>
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <CheckSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.task_name}</p>
                {task.due_date && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Due: {format(new Date(task.due_date), "MMM dd, yyyy")}
                  </p>
                )}
              </div>
              <Badge 
                variant={task.status === "Done" ? "default" : "secondary"}
                className="text-xs shrink-0"
              >
                {task.status || "To Do"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Calendar Events */}
      {events && events.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Calendar Events</h5>
          {events.map((event) => (
            <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{event.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(event.start_time), "MMM dd, yyyy 'at' h:mm a")}
                </p>
                {event.location && (
                  <p className="text-xs text-muted-foreground">{event.location}</p>
                )}
              </div>
              <Badge variant="outline" className="text-xs shrink-0">
                {event.status || "confirmed"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// activity_type is free text. These are the three Meet Alfred writes today; anything else
// falls back to a readable version of the raw value rather than being hidden.
function activityLabel(type: string): string {
  switch (type) {
    case "linkedin_connection":
      return "LinkedIn connection";
    case "linkedin_reply":
      return "LinkedIn reply";
    case "linkedin_lead":
      return "LinkedIn lead";
    case "sequence_click_routed":
      return "Clicked a link in a sequence email";
    default:
      return type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  }
}

function activityIcon(type: string) {
  const cls = "h-4 w-4 mt-0.5 text-muted-foreground shrink-0";
  if (type === "linkedin_reply") return <MessageSquare className={cls} />;
  if (type === "linkedin_lead") return <UserPlus className={cls} />;
  return <Linkedin className={cls} />;
}
