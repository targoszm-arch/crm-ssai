import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Campaign {
  id: string;
  meetalfred_id: number | null;
  name: string;
  type: string;
  status: string;
  audience: string | null;
  sent_count: number;
  open_rate: number;
  conversion_rate: number;
  sequence_type: string | null;
  total_leads: number;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCampaigns(statusFilter?: string) {
  return useQuery({
    queryKey: ["campaigns", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching campaigns:", error);
        throw error;
      }

      return data as Campaign[];
    },
  });
}

export function useSyncCampaigns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meetalfred-sync", {
        body: {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["linkedin-messages"] });
      
      const results = data?.results;
      if (results) {
        const messages = [];
        if (results.campaigns?.synced > 0) {
          messages.push(`${results.campaigns.synced} campaigns`);
        }
        if (results.replies?.synced > 0) {
          messages.push(`${results.replies.synced} replies`);
        }
        if (results.connections?.synced > 0) {
          messages.push(`${results.connections.synced} connections`);
        }
        if (results.leads?.synced > 0) {
          messages.push(`${results.leads.synced} leads`);
        }
        
        if (messages.length > 0) {
          toast.success(`Synced: ${messages.join(", ")}`);
        } else {
          toast.info("No new data to sync");
        }
      }
    },
    onError: (error) => {
      console.error("Sync error:", error);
      toast.error("Failed to sync with Meet Alfred");
    },
  });
}
