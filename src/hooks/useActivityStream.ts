import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * The timeline for one person or one company: notes, meetings, emails, calls —
 * everything that has happened, newest first, with somewhere to add to it.
 *
 * The rows were always there. Neither detail page queried `activities` or
 * `meeting_notes` at all, so 24 meeting notes and every hand-written activity
 * were stored and rendered nowhere, which is indistinguishable from not having
 * been saved.
 *
 * Two things make the feed readable:
 *
 *  - MeetAlfred is excluded by default. It is 67,071 of 67,119 rows — 99.93% —
 *    so including it means a contact's history is LinkedIn sync exhaust and the
 *    47 rows that describe the actual relationship are unfindable. It stays one
 *    toggle away rather than being deleted.
 *  - Meeting notes are folded in from their own table, because a meeting is
 *    part of the story whether or not someone also wrote an activity row.
 */

export type ActivityKind =
  | "note" | "meeting" | "email" | "call" | "linkedin" | "invoice" | "other";

export interface StreamItem {
  id: string;
  kind: ActivityKind;
  at: string;
  title: string | null;
  body: string | null;
  source: string | null;
  /** Named on the company view so a row can say which person it came from. */
  personName: string | null;
  /** Meeting notes are not editable here; notes written in the app are. */
  editable: boolean;
}

export interface StreamScope {
  contactId?: string | null;
  companyId?: string | null;
}

function kindOf(activityType: string | null): ActivityKind {
  const t = (activityType ?? "").toLowerCase();
  if (t.includes("note")) return "note";
  if (t.includes("meeting")) return "meeting";
  if (t.includes("email")) return "email";
  if (t.includes("call")) return "call";
  if (t.includes("linkedin")) return "linkedin";
  if (t.includes("invoice")) return "invoice";
  return "other";
}

function personLabel(row: { first_name?: string | null; last_name?: string | null } | null) {
  if (!row) return null;
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || null;
}

export function useActivityStream(scope: StreamScope, includeAutomation = false) {
  const { user } = useAuth();
  const key = scope.contactId ?? scope.companyId ?? null;

  return useQuery({
    queryKey: ["activity_stream", scope.contactId, scope.companyId, includeAutomation, user?.id],
    queryFn: async (): Promise<StreamItem[]> => {
      let activityQuery = supabase
        .from("activities")
        .select("id, activity_type, description, occurred_at, created_at, source, metadata, contacts:contact_id (first_name, last_name)")
        .order("occurred_at", { ascending: false, nullsFirst: false })
        .limit(200);

      let meetingQuery = supabase
        .from("meeting_notes")
        .select("id, title, meeting_date, overview, created_at, contacts:contact_id (first_name, last_name)")
        .order("meeting_date", { ascending: false })
        .limit(100);

      if (scope.contactId) {
        activityQuery = activityQuery.eq("contact_id", scope.contactId);
        meetingQuery = meetingQuery.eq("contact_id", scope.contactId);
      } else if (scope.companyId) {
        activityQuery = activityQuery.eq("company_id", scope.companyId);
        meetingQuery = meetingQuery.eq("company_id", scope.companyId);
      }

      if (!includeAutomation) {
        activityQuery = activityQuery.neq("source", "meetalfred");
      }

      const [activities, meetings] = await Promise.all([activityQuery, meetingQuery]);
      if (activities.error) throw activities.error;

      const items: StreamItem[] = ((activities.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: `activity:${row.id}`,
        kind: kindOf(row.activity_type as string | null),
        at: (row.occurred_at as string) || (row.created_at as string),
        title: (row.activity_type as string) ?? null,
        body: (row.description as string) ?? null,
        source: (row.source as string) ?? null,
        personName: personLabel(row.contacts as never),
        editable: (row.source ?? null) === "manual",
      }));

      // meeting_notes has no company_id on older rows, so a company query can
      // come back empty here even when the contact query found the meeting.
      // Failing the whole stream for that would be worse than showing the rest.
      if (!meetings.error) {
        for (const row of (meetings.data ?? []) as Array<Record<string, unknown>>) {
          items.push({
            id: `meeting:${row.id}`,
            kind: "meeting",
            at: (row.meeting_date as string) || (row.created_at as string),
            title: (row.title as string) ?? "Meeting",
            body: (row.overview as string) ?? null,
            source: "meeting_notes",
            personName: personLabel(row.contacts as never),
            editable: false,
          });
        }
      }

      return items
        .filter((item) => item.at)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    },
    enabled: !!user && !!key,
  });
}

/** Counts the automation rows hidden from the feed, so the toggle can say how many. */
export function useAutomationCount(scope: StreamScope) {
  const { user } = useAuth();
  const key = scope.contactId ?? scope.companyId ?? null;

  return useQuery({
    queryKey: ["activity_automation_count", scope.contactId, scope.companyId, user?.id],
    queryFn: async () => {
      let query = supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("source", "meetalfred");
      query = scope.contactId
        ? query.eq("contact_id", scope.contactId)
        : query.eq("company_id", scope.companyId!);
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user && !!key,
  });
}

export function useAddNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ scope, text }: { scope: StreamScope; text: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const body = text.trim();
      if (!body) throw new Error("Note is empty");

      // company_id is filled by a trigger when only contact_id is given, so a
      // note written on a person also reaches their company's timeline.
      const { error } = await supabase.from("activities").insert({
        user_id: user.id,
        contact_id: scope.contactId ?? null,
        company_id: scope.companyId ?? null,
        activity_type: "note",
        source: "manual",
        description: body,
        occurred_at: new Date().toISOString(),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity_stream"] });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (streamId: string) => {
      const id = streamId.replace(/^activity:/, "");
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity_stream"] }),
  });
}
