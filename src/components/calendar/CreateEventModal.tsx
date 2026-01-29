import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import { useCreateCalendarEvent } from "@/hooks/useCalendarEvents";
import { useContacts } from "@/hooks/useContacts";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  defaultDate?: Date;
}

export function CreateEventModal({ open, onOpenChange, accountId, defaultDate }: CreateEventModalProps) {
  const createEvent = useCreateCalendarEvent();
  const { data: contacts } = useContacts();

  const defaultStartDate = defaultDate || new Date();
  defaultStartDate.setHours(9, 0, 0, 0);
  const defaultEndDate = new Date(defaultStartDate);
  defaultEndDate.setHours(10, 0, 0, 0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState(format(defaultStartDate, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(format(defaultStartDate, "HH:mm"));
  const [endDate, setEndDate] = useState(format(defaultEndDate, "yyyy-MM-dd"));
  const [endTime, setEndTime] = useState(format(defaultEndDate, "HH:mm"));
  const [allDay, setAllDay] = useState(false);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [newAttendee, setNewAttendee] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Event title is required",
        variant: "destructive",
      });
      return;
    }

    const startDateTime = allDay
      ? `${startDate}T00:00:00Z`
      : `${startDate}T${startTime}:00Z`;
    const endDateTime = allDay
      ? `${endDate}T23:59:59Z`
      : `${endDate}T${endTime}:00Z`;

    createEvent.mutate(
      {
        accountId,
        title,
        description: description || undefined,
        location: location || undefined,
        startTime: startDateTime,
        endTime: endDateTime,
        allDay,
        attendees,
        contactId: selectedContactId || undefined,
      },
      {
        onSuccess: (data) => {
          toast({
            title: "Event Created",
            description: data.meetingLink
              ? "Event created with Google Meet link"
              : "Event added to your calendar",
          });
          onOpenChange(false);
          resetForm();
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setStartTime("09:00");
    setEndDate(format(new Date(), "yyyy-MM-dd"));
    setEndTime("10:00");
    setAllDay(false);
    setAttendees([]);
    setNewAttendee("");
    setSelectedContactId("");
  };

  const addAttendee = () => {
    if (newAttendee && !attendees.includes(newAttendee)) {
      setAttendees([...attendees, newAttendee]);
      setNewAttendee("");
    }
  };

  const removeAttendee = (email: string) => {
    setAttendees(attendees.filter((a) => a !== email));
  };

  const addContactAsAttendee = (contactId: string) => {
    const contact = contacts?.find((c) => c.id === contactId);
    if (contact?.email && !attendees.includes(contact.email)) {
      setAttendees([...attendees, contact.email]);
      setSelectedContactId(contactId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch id="allDay" checked={allDay} onCheckedChange={setAllDay} />
            <Label htmlFor="allDay">All day event</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              {!allDay && (
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              {!allDay && (
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location or leave empty for Google Meet"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Attendees</Label>
            <div className="flex gap-2">
              <Select onValueChange={addContactAsAttendee}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Add from contacts..." />
                </SelectTrigger>
                <SelectContent>
                  {contacts
                    ?.filter((c) => c.email)
                    .map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name} ({contact.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input
                value={newAttendee}
                onChange={(e) => setNewAttendee(e.target.value)}
                placeholder="Or type email address..."
                type="email"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAttendee();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addAttendee}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attendees.map((email) => (
                  <div
                    key={email}
                    className="flex items-center gap-1 bg-secondary px-2 py-1 rounded text-sm"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeAttendee(email)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createEvent.isPending}>
              {createEvent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Event
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
