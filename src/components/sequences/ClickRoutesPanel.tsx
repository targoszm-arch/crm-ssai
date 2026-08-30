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
import { MousePointerClick, Plus, Trash2, Loader2 } from "lucide-react";
import {
  useClickRoutes, useClickRouteStats, useCreateClickRoute,
  useUpdateClickRoute, useDeleteClickRoute, ClickRoute,
} from "@/hooks/useClickRoutes";
import { useSequences } from "@/hooks/useSequences";

const NO_SEQUENCE = "__none__";

/**
 * Configures what a click means. Each row says: a link containing this text means this
 * topic, so label the contact and (optionally) start them on this sequence. The rules are
 * evaluated in Postgres when a click arrives — this panel only edits them.
 */
export function ClickRoutesPanel() {
  const { data: routes, isLoading } = useClickRoutes();
  const { data: clickEvents } = useClickRouteStats();
  const { data: sequences } = useSequences();

  const createRoute = useCreateClickRoute();
  const updateRoute = useUpdateClickRoute();
  const deleteRoute = useDeleteClickRoute();

  const [showForm, setShowForm] = useState(false);
  const [topic, setTopic] = useState("");
  const [matchPattern, setMatchPattern] = useState("");
  const [label, setLabel] = useState("");
  const [sequenceId, setSequenceId] = useState<string>(NO_SEQUENCE);
  const [priority, setPriority] = useState("0");
  const [pendingDelete, setPendingDelete] = useState<ClickRoute | null>(null);

  const sequenceName = (id: string | null) =>
    id ? sequences?.find((s) => s.id === id)?.name ?? "(deleted sequence)" : null;

  // Count recorded clicks each pattern matches, using the same case-insensitive substring
  // rule the database uses, so what you see here is what routing would do.
  const matchCounts = useMemo(() => {
    const counts = new Map<string, { clicks: number; people: Set<string> }>();
    if (!routes || !clickEvents) return counts;
    for (const route of routes) {
      const needle = route.match_pattern.toLowerCase();
      const entry = { clicks: 0, people: new Set<string>() };
      for (const event of clickEvents) {
        if (event.link_url && event.link_url.toLowerCase().includes(needle)) {
          entry.clicks += 1;
          if (event.contact_id) entry.people.add(event.contact_id);
        }
      }
      counts.set(route.id, entry);
    }
    return counts;
  }, [routes, clickEvents]);

  const resetForm = () => {
    setTopic("");
    setMatchPattern("");
    setLabel("");
    setSequenceId(NO_SEQUENCE);
    setPriority("0");
    setShowForm(false);
  };

  const handleCreate = () => {
    createRoute.mutate(
      {
        topic: topic.trim(),
        match_pattern: matchPattern.trim(),
        label: label.trim(),
        enrol_sequence_id: sequenceId === NO_SEQUENCE ? null : sequenceId,
        priority: Number.parseInt(priority, 10) || 0,
      },
      { onSuccess: resetForm },
    );
  };

  const canSave = topic.trim() && matchPattern.trim() && label.trim();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MousePointerClick className="h-5 w-5" />
            Click routing
          </CardTitle>
          <CardDescription>
            Which card someone clicks tells you what they care about. Each rule turns a
            clicked link into a label on the contact, and optionally starts them on the
            sequence for that topic.
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
                <Label htmlFor="route-topic">Topic</Label>
                <Input
                  id="route-topic"
                  placeholder="sop"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Your name for what the click means. Shows up in the contact's timeline.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="route-pattern">Link contains</Label>
                <Input
                  id="route-pattern"
                  placeholder="/sop"
                  value={matchPattern}
                  onChange={(e) => setMatchPattern(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Matched anywhere in the clicked URL, ignoring case. Be specific —
                  "/sop" also matches "/sop-advanced".
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="route-label">Label to apply</Label>
                <Input
                  id="route-label"
                  placeholder="SOP"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This is the segment. Filter contacts by it, or save it as a list.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="route-sequence">Then enrol in</Label>
                <Select value={sequenceId} onValueChange={setSequenceId}>
                  <SelectTrigger id="route-sequence">
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
                <Label htmlFor="route-priority">Priority</Label>
                <Input
                  id="route-priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Highest wins when a link matches more than one rule. Ties go to the
                  longer, more specific pattern.
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
            <MousePointerClick className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">No click routing yet</p>
            <p className="text-sm">
              Clicks are being recorded, but nothing is being done with them. Add a rule per
              card in your indoctrination email.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead>Link contains</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Then enrol in</TableHead>
                <TableHead className="text-right">Clicks matched</TableHead>
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
                        {route.match_pattern}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{route.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sequenceName(route.enrol_sequence_id) ?? "Label only"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {stats
                        ? `${stats.clicks} (${stats.people.size} ${
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
              Future clicks on links containing "{pendingDelete?.match_pattern}" will stop
              being segmented. Contacts already labelled "{pendingDelete?.label}" keep their
              label, and anyone already enrolled stays enrolled.
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
