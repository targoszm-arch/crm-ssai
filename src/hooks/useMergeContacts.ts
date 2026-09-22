import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMergeContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ survivorId, loserIds }: { survivorId: string; loserIds: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("merge_contacts", {
        p_survivor_id: survivorId,
        p_loser_ids: loserIds,
        p_user_id: user.id,
      });
      if (error) throw error;
      return data as { survivor_id: string; merged_count: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-filter-options"] });
      queryClient.invalidateQueries({ queryKey: ["company-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["existing-contact-emails"] });
    },
  });
}
