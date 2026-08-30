import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Click routes are the rule set behind segmentation-by-click: when someone clicks a card
 * in an email, the URL they clicked decides which label they get and which sequence they
 * go into next. The matching itself lives in the Postgres function route_sequence_click,
 * which both click paths (track-sequence-click and resend-webhook) call.
 */
export interface ClickRoute {
  id: string;
  user_id: string | null;
  topic: string;
  match_pattern: string;
  label: string;
  enrol_sequence_id: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useClickRoutes() {
  return useQuery({
    queryKey: ["click-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sequence_click_routes")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as ClickRoute[];
    },
  });
}

/**
 * How many clicks each route has matched so far, and how many people it has segmented.
 * Read from email_tracking_events rather than from a counter, so the numbers stay true
 * for clicks recorded before a route existed — add a route today and you can see how
 * much traffic it would have caught.
 */
export function useClickRouteStats() {
  return useQuery({
    queryKey: ["click-route-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_tracking_events")
        .select("contact_id, link_url")
        .eq("event_type", "click")
        .not("link_url", "is", null);

      if (error) throw error;
      return (data || []) as Array<{ contact_id: string | null; link_url: string | null }>;
    },
  });
}

export function useCreateClickRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (route: Partial<ClickRoute>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("sequence_click_routes")
        .insert({
          user_id: user.id,
          topic: route.topic!,
          match_pattern: route.match_pattern!,
          label: route.label!,
          enrol_sequence_id: route.enrol_sequence_id || null,
          priority: route.priority ?? 0,
          is_active: route.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ClickRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["click-routes"] });
      toast.success("Click route saved");
    },
    onError: (error: Error) => {
      console.error("Create click route error:", error);
      toast.error("Failed to save click route: " + error.message);
    },
  });
}

export function useUpdateClickRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ClickRoute> & { id: string }) => {
      const { data, error } = await supabase
        .from("sequence_click_routes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as ClickRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["click-routes"] });
    },
    onError: (error: Error) => {
      console.error("Update click route error:", error);
      toast.error("Failed to update click route: " + error.message);
    },
  });
}

export function useDeleteClickRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sequence_click_routes").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["click-routes"] });
      toast.success("Click route deleted");
    },
    onError: (error: Error) => {
      console.error("Delete click route error:", error);
      toast.error("Failed to delete click route: " + error.message);
    },
  });
}
