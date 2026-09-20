import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Zap, Plus, Trash2, Loader2 } from "lucide-react";
import {
  useLmsEventRoutes, useLmsEventRouteStats, useCreateLmsEventRoute,
  useUpdateLmsEventRoute, useDeleteLmsEventRoute, LmsEventRoute, LMS_EVENT_NAMES,
} from "@/hooks/useLmsEventRoutes";
import { useSequences } from "@/hooks/useSequences";

const NO_SEQUENCE = "__none__";

// Grouping is cosmetic only — route_lms_event matches on the exact event_name regardless
// of which group it's picked from.
const STARTED_EVENTS = new Set(
  LMS_EVENT_NAMES.filter((name) => name.endsWith("_started"))
);

/**
 * Configures what an LMS product event means. Each row says: this event (a course was
 * created, a block type was used, a flow was started but maybe not finished) means this
 * topic, so label the contact and (optionally) start them on this topic's sequence. The
 * rules are evaluated in Postgres, in route_lms_event, when lms-webhook receives the
 * event — this panel only edits them. Sibling to Click Routing, same shape, different
 * trigger: a link click there, an LMS action here.
 */
export function LmsEventRoutesPanel() {
  const { data: routes, isLoading } = useLmsEventRoutes();
  const { data: routeEvents } = useLmsEventRouteStats();
  const { data: sequences } = useSequences();

  const createRoute = useCreateLmsEventRoute();
  const updateRoute = useUpdateLmsEventRoute();
  const deleteRoute = useDeleteLmsEventRoute();

  const [showForm, setShowForm] = useState(false);
  const [topic, setTopic] = useState("");
  const [eventName, setEventName] = useState<string>("");
  const [label, setLabel] = useState("");
  const [sequenceId, setSequenceId] = useState<string>(NO_SEQUENCE);
  const [priority, setPriority] = useState("0");
  const [pendingDelete, setPendingDelete] = useState<LmsEventRoute | null>(null);

  const sequenceName = (id: string | null) =>
    id ? sequences?.find((s) => s.id === id)?.name ?? "(deleted sequence)" : null;

  // Already-routed contacts/hits per rule, read from the activities route_lms_event
  // writes on every call — so what you see here is what has actually fired, not a
  // client-side re-derivation of it.
  const matchCounts = useMemo(() => {
    const counts = new Map<string, { hits: number; people: Set<string> }>();
    if (!routes || !routeEvents) return counts;
    for (const route of routes) {
      const entry = { hits: 0, people: new Set<string>() };
      for (const event of routeEvents) {
        if (event.metadata?.route_id === route.id) {
          entry.hits += 1;
          if (event.contact_id) entry.people.add(event.contact_id);
        }
      }
      counts.set(route.id, entry);
    }
    return counts;
  }, [routes, routeEvents]);

  const resetForm = () => {
    setTopic("");
    setEventName("");
    setLabel("");
    setSequenceId(NO_SEQUENCE);
    setPriority("0");
    setShowForm(false);
  };

  const handleCreate = () => {
    createRoute.mutate(
      {
        topic: topic.trim(),
        event_name: eventName,
        label: label.trim(),
        enrol_sequence_id: sequenceId === NO_SEQUENCE ? null : sequenceId,
        priority: Number.parseInt(priority, 10) || 0,
      },
      { onSuccess: resetForm },
    );
  };

  const canSave = topic.trim() && eventName && label.trim();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            LMS event routing
          </CardTitle>
          <CardDescription>
            What someone does in Skill Studio tells you where they are — including when
            they start something and don't finish it. Each rule turns an LMS product event
            into a label on the contact, and optionally starts them on the sequence for
            that topic.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" />
          Add rule
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {showForm && (
          <div className="rounded-lg border p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-route-topic">Topic</Label>
                <Input
                  id="event-route-topic"
                  placeholder="scorm-import"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Your name for what the event means. Shows up in the contact's timeline.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-route-name">LMS event</Label>
                <Select value={eventName} onValueChange={setEventName}>
                  <SelectTrigger id="event-route-name">
                    <SelectValue placeholder="Select an event" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {LMS_EVENT_NAMES.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                        {STARTED_EVENTS.has(name) ? " (started, not completed)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Matched exactly — pick the "_started" version to guide someone who began
                  a flow and didn't finish it, or the completed/used version for after.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-route-label">Label to apply</Label>
                <Input
                  id="event-route-label"
                  placeholder="SCORM Importer"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This is the segment. Filter contacts by it, or save it as a list.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-route-sequence">Then enrol in</Label>
                <Select value={sequenceId} onValueChange={setSequenceId}>
                  <SelectTrigger id="event-route-sequence">
                    <SelectValue placeholder="Label only" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SEQUENCE}>Label only — don't enrol</SelectItem>
                    {sequences?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Leave as label only until the follow-on sequence is written.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-route-priority">Priority</Label>
                <Input
                  id="event-route-priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Highest wins if more than one active rule somehow names the same event.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!canSave || createRoute.isPending}>
                {createRoute.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save rule
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !routes?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">No LMS event routing yet</p>
            <p className="text-sm">
              Events are arriving from the LMS, but nothing is being done with them. Add a
              rule per action you want to guide someone on — including "_started" events,
              for when they begin something and don't complete it.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead>LMS event</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Then enrol in</TableHead>
                <TableHead className="text-right">Matched</TableHead>
                <TableHead className="text-right">Priority</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route) => {
                const stats = matchCounts.get(route.id);
                return (
                  <TableRow key={route.id}>
                    <TableCell className="font-medium">{route.topic}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {route.event_name}
                      </code>
                      {STARTED_EVENTS.has(route.event_name as typeof LMS_EVENT_NAMES[number]) && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          started
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{route.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sequenceName(route.enrol_sequence_id) ?? "Label only"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {stats
                        ? `${stats.hits} (${stats.people.size} ${
                            stats.people.size === 1 ? "person" : "people"
                          })`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{route.priority}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={route.is_active}
                        onCheckedChange={(checked) =>
                          updateRoute.mutate({ id: route.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPendingDelete(route)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Future "{pendingDelete?.event_name}" events will stop being segmented.
              Contacts already labelled "{pendingDelete?.label}" keep their label, and
              anyone already enrolled stays enrolled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteRoute.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
