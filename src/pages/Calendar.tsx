import { useState, useEffect } from "react";
import { startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, RefreshCw, Loader2 } from "lucide-react";
import { useEmailAccounts } from "@/hooks/useEmailAccounts";
import { useCalendarEvents, useSyncCalendar } from "@/hooks/useCalendarEvents";
import { ConnectCalendar } from "@/components/calendar/ConnectCalendar";
import { CalendarView } from "@/components/calendar/CalendarView";
import { CreateEventModal } from "@/components/calendar/CreateEventModal";
import { EventCard } from "@/components/calendar/EventCard";
import { toast } from "@/hooks/use-toast";

export default function Calendar() {
  const { data: accounts, isLoading: accountsLoading } = useEmailAccounts();
  const connectedAccount = accounts?.[0];

  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      start: subMonths(startOfMonth(now), 1),
      end: addMonths(endOfMonth(now), 2),
    };
  });

  const { data: events, isLoading: eventsLoading } = useCalendarEvents(
    connectedAccount?.id,
    dateRange.start,
    dateRange.end
  );

  const syncCalendar = useSyncCalendar();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedEvent, setSelectedEvent] = useState<typeof events extends (infer T)[] ? T : never | null>(null);

  // Initial sync when account is connected
  useEffect(() => {
    if (connectedAccount?.id && !events?.length && !eventsLoading) {
      syncCalendar.mutate(connectedAccount.id);
    }
  }, [connectedAccount?.id]);

  const handleSync = () => {
    if (!connectedAccount?.id) return;
    syncCalendar.mutate(connectedAccount.id, {
      onSuccess: (data) => {
        toast({
          title: "Calendar Synced",
          description: `Synced ${data.syncedCount} events`,
        });
      },
      onError: (error) => {
        toast({
          title: "Sync Failed",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setCreateModalOpen(true);
  };

  const handleEventClick = (event: NonNullable<typeof events>[number]) => {
    setSelectedEvent(event);
  };

  const handleMonthChange = (start: Date, end: Date) => {
    setDateRange({
      start: subMonths(start, 1),
      end: addMonths(end, 1),
    });
  };

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connectedAccount) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <ConnectCalendar />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-muted-foreground text-sm">
            Connected: {connectedAccount.email_address}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncCalendar.isPending}
          >
            {syncCalendar.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync
          </Button>
          <Button size="sm" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 min-h-0">
        {eventsLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <CalendarView
            events={events || []}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            onMonthChange={handleMonthChange}
          />
        )}
      </div>

      {/* Create Event Modal */}
      <CreateEventModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        accountId={connectedAccount.id}
        defaultDate={selectedDate}
      />

      {/* Event Detail Sheet */}
      <Sheet open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Event Details</SheetTitle>
          </SheetHeader>
          {selectedEvent && (
            <div className="mt-6">
              <EventCard event={selectedEvent} />
              {selectedEvent.description && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedEvent.description}
                  </p>
                </div>
              )}
              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Attendees</h4>
                  <ul className="space-y-1">
                    {selectedEvent.attendees.map((email) => (
                      <li key={email} className="text-sm text-muted-foreground">
                        {email}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
