import { Contact } from "@/hooks/useContacts";
import { format } from "date-fns";
import { 
  Mail, 
  Calendar, 
  Activity, 
  TrendingUp, 
  Clock 
} from "lucide-react";

interface EngagementTabProps {
  contact: Contact;
}

export function EngagementTab({ contact }: EngagementTabProps) {
  const stats = [
    {
      icon: Mail,
      label: "Email Messages",
      value: contact.email_messages_count || 0,
      color: "text-blue-500",
    },
    {
      icon: Activity,
      label: "Completed Activities",
      value: contact.done_activities || 0,
      color: "text-green-500",
    },
    {
      icon: TrendingUp,
      label: "Lead Quality Score",
      value: contact.lqs || "-",
      color: "text-yellow-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Engagement Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="p-3 rounded-lg border bg-card text-center">
            <stat.icon className={`h-5 w-5 mx-auto mb-2 ${stat.color}`} />
            <p className="text-lg font-semibold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Timeline Info */}
      <div className="space-y-3">
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Timeline
        </h5>
        
        {contact.last_contacted && (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Last Contacted</p>
              <p className="text-sm font-medium">
                {format(new Date(contact.last_contacted), "MMM dd, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        )}

        {contact.next_to_contact && (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Next Contact Date</p>
              <p className="text-sm font-medium">
                {format(new Date(contact.next_to_contact), "MMM dd, yyyy")}
              </p>
            </div>
          </div>
        )}

        {contact.last_email_received && (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Last Email Received</p>
              <p className="text-sm font-medium">
                {format(new Date(contact.last_email_received), "MMM dd, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        )}

        {contact.created_at && (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Contact Created</p>
              <p className="text-sm font-medium">
                {format(new Date(contact.created_at), "MMM dd, yyyy")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Connection Strength */}
      {contact.connection_strength && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Connection
          </h5>
          <div className="p-3 rounded-lg border bg-card">
            <p className="text-sm font-medium">{contact.connection_strength}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Based on interaction frequency and engagement
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
