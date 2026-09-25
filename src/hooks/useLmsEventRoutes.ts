import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * LMS event routes are click routing's sibling: instead of "which link did they click",
 * the rule is "which LMS product event happened". Each rule labels the contact and,
 * optionally, starts them on the sequence for that topic. The matching itself lives in
 * the Postgres function route_lms_event, called by lms-webhook whenever the LMS sends a
 * payload with an event_type.
 */
export interface LmsEventRoute {
  id: string;
  user_id: string | null;
  topic: string;
  event_name: string;
  label: string;
  enrol_sequence_id: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// The full event vocabulary the LMS can send, as of the track-posthog-event allowlist —
// completion/usage events plus their "_started" counterparts. Kept here rather than
// queried live so the picker works even before any event of a given name has arrived.
export const LMS_EVENT_NAMES = [
  // Completed / used
  "video_generation_completed",
  "image_generation_completed",
  "infographic_generation_completed",
  "course_from_pdf_created",
  "slides_to_course_created",
  "scorm_to_course_created",
  "template_to_course_created",
  "content_screen_used",
  "canvas_screen_used",
  "video_screen_used",
  "infographics_screen_used",
  "document_screen_used",
  "workbook_screen_used",
  "embed_screen_used",
  "ai_exercise_used",
  "quiz_used",
  "scenario_question_used",
  "flip_cards_used",
  "card_sorting_used",
  "checklist_screen_used",
  "how_to_steps_used",
  "expandable_info_used",
  "image_hotspots_used",
  "video_hotspots_used",
  "fill_in_blank_used",
  "true_false_used",
  "carousel_used",
  "import_content_used",
  "convert_ppt_to_course_used",
  // Started, not (yet) completed
  "course_from_pdf_started",
  "slides_to_course_started",
  "scorm_to_course_started",
  "template_to_course_started",
  "ai_exercise_started",
  "quiz_started",
  "flip_cards_started",
  "card_sorting_started",
  "image_hotspots_started",
  "video_hotspots_started",
  "convert_ppt_to_course_started",
  "create_video_started",
  "candace_used",
  // Billing, sent by the LMS stripe-webhook rather than track-posthog-event.
  // free_subscription_created fires once per signup for accounts that still get the old
  // auto-provisioned Free Stripe subscription — a shrinking minority since most signups
  // now go through a Starter-trial Stripe Checkout instead (see account_created below).
  // paid_subscription_activated fires once per paid subscription (Starter and up), on
  // whichever of subscription.created / checkout.session.completed activates it first.
  "free_subscription_created",
  "paid_subscription_activated",
  // account_created fires once per signup, at the auth.users insert (track-user-signup),
  // regardless of whether the person ever completes a Stripe checkout. This is the
  // reliable onboarding trigger: as of Sep 2026, 17 of the last 21 signups never got a
  // free_subscription_created event at all, because the primary signup flow now routes
  // through a Starter-plan trial Checkout Session that most people abandon before it
  // creates a subscription.
  "account_created",
  // trial_checkout_abandoned fires from the LMS stripe-webhook on checkout.session.expired
  // for a signup_trial session that was never completed (Stripe expires these ~24h after
  // creation) — the "you started but didn't finish" recovery trigger.
  "trial_checkout_abandoned",
] as const;

export function useLmsEventRoutes() {
  return useQuery({
    queryKey: ["lms-event-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_event_routes")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as LmsEventRoute[];
    },
  });
}

/**
 * How many times each route's event has actually been routed, and how many contacts it
 * touched. Read from activities (lms_event_routed), the same table route_lms_event writes
 * to on every call, matched or not is filtered out by only counting rows this route's
 * metadata.route_id was responsible for.
 */
export function useLmsEventRouteStats() {
  return useQuery({
    queryKey: ["lms-event-route-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("contact_id, metadata")
        .eq("activity_type", "lms_event_routed");

      if (error) throw error;
      return (data || []) as Array<{
        contact_id: string | null;
        metadata: { route_id?: string } | null;
      }>;
    },
  });
}

export function useCreateLmsEventRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (route: Partial<LmsEventRoute>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("lms_event_routes")
        .insert({
          user_id: user.id,
          topic: route.topic!,
          event_name: route.event_name!,
          label: route.label!,
          enrol_sequence_id: route.enrol_sequence_id || null,
          priority: route.priority ?? 0,
          is_active: route.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as LmsEventRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lms-event-routes"] });
      toast.success("Event route saved");
    },
    onError: (error: Error) => {
      console.error("Create LMS event route error:", error);
      toast.error("Failed to save event route: " + error.message);
    },
  });
}

export function useUpdateLmsEventRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LmsEventRoute> & { id: string }) => {
      const { data, error } = await supabase
        .from("lms_event_routes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as LmsEventRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lms-event-routes"] });
    },
    onError: (error: Error) => {
      console.error("Update LMS event route error:", error);
      toast.error("Failed to update event route: " + error.message);
    },
  });
}

export function useDeleteLmsEventRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lms_event_routes").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lms-event-routes"] });
      toast.success("Event route deleted");
    },
    onError: (error: Error) => {
      console.error("Delete LMS event route error:", error);
      toast.error("Failed to delete event route: " + error.message);
    },
  });
}
