import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMeetingNotes } from "@/hooks/useMeetingNotes";
import { format } from "date-fns";
import { 
  Mail, 
  Calendar, 
  CheckSquare, 
  FileText, 
  DollarSign, 
  Target,
  Loader2
} from "lucide-react";
import { Contact } from "@/hooks/useContacts";

interface AllTabProps {
  contact: Contact;
}

interface TimelineItem {
  id: string;
  type: "email" | "task" | "event" | "note" | "deal" | "lead";
  title: string;
  subtitle?: string;
  date: Date;
  icon: typeof Mail;
  color: string;
}

export function AllTab({ contact }: AllTabProps) {
  // Fetch all related data
  const { data: emails, isLoading: emailsLoading } = useQuery({
    queryKey: ["contact-emails", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emails")
        .select("id, subject, received_at, from_name")
        .eq("contact_id", contact.id)
        .order("received_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["contact-tasks", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, task_name, created_at, status")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["contact-events", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id, title, start_time")
        .eq("contact_id", contact.id)
        .order("start_time", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ["contact-deals", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, deal_name, created_at, stage")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: meetingNotes, isLoading: notesLoading } = useMeetingNotes(contact.id);

  const isLoading = emailsLoading || tasksLoading || eventsLoading || dealsLoading || notesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Build timeline
  const timeline: TimelineItem[] = [];

  emails?.forEach((email) => {
    timeline.push({
      id: `email-${email.id}`,
      type: "email",
      title: email.subject || "(No subject)",
      subtitle: email.from_name,
      date: new Date(email.received_at),
      icon: Mail,
      color: "text-blue-500",
    });
  });

  tasks?.forEach((task) => {
    timeline.push({
      id: `task-${task.id}`,
      type: "task",
      title: task.task_name,
      subtitle: task.status,
      date: new Date(task.created_at),
      icon: CheckSquare,
      color: "text-green-500",
    });
  });

  events?.forEach((event) => {
    timeline.push({
      id: `event-${event.id}`,
      type: "event",
      title: event.title,
      date: new Date(event.start_time),
      icon: Calendar,
      color: "text-purple-500",
    });
  });

  deals?.forEach((deal) => {
    timeline.push({
      id: `deal-${deal.id}`,
      type: "deal",
      title: deal.deal_name,
      subtitle: deal.stage,
      date: new Date(deal.created_at),
      icon: DollarSign,
      color: "text-yellow-500",
    });
  });

  meetingNotes?.forEach((note) => {
    timeline.push({
      id: `note-${note.id}`,
      type: "note",
      title: note.title,
      subtitle: note.meeting_type,
      date: new Date(note.meeting_date),
      icon: FileText,
      color: "text-orange-500",
    });
  });

  // Sort by date descending
  timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No activity yet</p>
        <p className="text-xs mt-1">Emails, tasks, events, and meeting notes will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {timeline.map((item) => (
        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
          <item.icon className={`h-4 w-4 mt-0.5 ${item.color}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {item.subtitle && (
                <>
                  <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                {format(item.date, "MMM dd, yyyy")}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
