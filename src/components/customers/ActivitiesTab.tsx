import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Calendar, CheckSquare, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  const isLoading = tasksLoading || eventsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasActivities = (tasks && tasks.length > 0) || (events && events.length > 0);

  if (!hasActivities) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No activities yet</p>
        <p className="text-xs mt-1">Tasks and calendar events linked to this contact will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
