import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MatchedContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

/**
 * Name/email for a set of contact ids a route has matched, so "1 person matched" opens
 * into actual people — with somewhere to click through to their profile — instead of
 * being a dead-end count. Skipped entirely when there's nothing to look up.
 */
export function useContactsByIds(ids: string[]) {
  return useQuery({
    queryKey: ["contacts-by-ids", [...ids].sort()],
    queryFn: async () => {
      if (ids.length === 0) return [] as MatchedContact[];
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .in("id", ids);
      if (error) throw error;
      return (data || []) as MatchedContact[];
    },
    enabled: ids.length > 0,
  });
}

/**
 * Which of a route's matched contacts are already enrolled in its sequence — so the
 * "who matched" dialog can show real per-person state instead of just a name and email.
 */
export function useEnrollmentStatus(contactIds: string[], sequenceId: string | null) {
  return useQuery({
    queryKey: ["route-enrollment-status", [...contactIds].sort(), sequenceId],
    queryFn: async () => {
      if (!sequenceId || contactIds.length === 0) return new Set<string>();
      const { data, error } = await supabase
        .from("sequence_enrollments")
        .select("contact_id, status")
        .eq("sequence_id", sequenceId)
        .in("contact_id", contactIds)
        .in("status", ["active", "completed"]);
      if (error) throw error;
      return new Set((data || []).map((row) => row.contact_id as string));
    },
    enabled: !!sequenceId && contactIds.length > 0,
  });
}

/**
 * Enrols an already-matched set of contacts into a sequence — for a route that was
 * "label only" when people matched it, with a sequence attached afterwards, or for
 * catching up people who matched before this action existed at all. Applies the same
 * guard chain a live match would (see backfill_route_enrollments), so this can never
 * enrol someone a real-time match wouldn't have.
 */
export function useBackfillRouteEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      contactIds: string[];
      sequenceId: string;
      routeId: string;
      topic: string;
      label: string;
    }) => {
      const { data, error } = await supabase.rpc("backfill_route_enrollments", {
        p_contact_ids: args.contactIds,
        p_sequence_id: args.sequenceId,
        p_source: "manual_route_backfill",
        p_route_id: args.routeId,
        p_topic: args.topic,
        p_label: args.label,
      });
      if (error) throw error;
      return data as { enrolled: number; skipped: Record<string, number>; total: number };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sequence-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["sequence-stats"] });
      queryClient.invalidateQueries({ queryKey: ["route-enrollment-status"] });
      const skippedTotal = Object.values(result.skipped || {}).reduce((a, b) => a + b, 0);
      if (result.enrolled === 0 && skippedTotal > 0) {
        toast.warning(`Nobody newly enrolled — ${skippedTotal} already enrolled or not contactable`);
      } else {
        toast.success(
          `Enrolled ${result.enrolled} of ${result.total}` +
            (skippedTotal > 0 ? ` (${skippedTotal} skipped)` : ""),
        );
      }
    },
    onError: (error: Error) => {
      console.error("Backfill route enrollment error:", error);
      toast.error("Failed to enrol matched contacts: " + error.message);
    },
  });
}
