import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

export type Deal = Tables<"deals"> & {
  contacts?: Tables<"contacts"> | null;
  companies?: Tables<"companies"> | null;
};

export interface DealFilters {
  pipelineId?: string;
  stage?: string;
  search?: string;
  contactId?: string;
  companyId?: string;
}

export function useDeals(filters?: DealFilters) {
  return useQuery({
    queryKey: ["deals", filters],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select(`
          *,
          contacts:contact_id (*),
          companies:company_id (*)
        `)
        .order("created_at", { ascending: false });
      
      if (filters?.pipelineId) {
        query = query.eq("pipeline_id", filters.pipelineId);
      }
      
      if (filters?.stage) {
        query = query.eq("stage", filters.stage);
      }
      
      if (filters?.contactId) {
        query = query.eq("contact_id", filters.contactId);
      }
      
      if (filters?.companyId) {
        query = query.eq("company_id", filters.companyId);
      }
      
      if (filters?.search) {
        query = query.ilike("deal_name", `%${filters.search}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Deal[];
    },
  });
}

export function useDeal(dealId: string | undefined) {
  return useQuery({
    queryKey: ["deal", dealId],
    queryFn: async () => {
      if (!dealId) return null;
      
      const { data, error } = await supabase
        .from("deals")
        .select(`
          *,
          contacts:contact_id (*),
          companies:company_id (*)
        `)
        .eq("id", dealId)
        .single();
      
      if (error) throw error;
      return data as Deal;
    },
    enabled: !!dealId,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deal: Partial<Tables<"deals">>) => {
      const { data, error } = await supabase
        .from("deals")
        .insert({
          deal_name: deal.deal_name || "Untitled Deal",
          ...deal,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal created");
    },
    onError: (error) => {
      toast.error("Failed to create deal: " + error.message);
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Tables<"deals">> & { id: string }) => {
      const { data, error } = await supabase
        .from("deals")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (error) => {
      toast.error("Failed to update deal: " + error.message);
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dealId: string) => {
      const { error } = await supabase
        .from("deals")
        .delete()
        .eq("id", dealId);
      
      if (error) throw error;
      return dealId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete deal: " + error.message);
    },
  });
}

export function useMoveDealToStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, stage, position }: { dealId: string; stage: string; position?: number }) => {
      const { data, error } = await supabase
        .from("deals")
        .update({ 
          stage, 
          position: position ?? 0,
          updated_at: new Date().toISOString() 
        })
        .eq("id", dealId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (error) => {
      toast.error("Failed to move deal: " + error.message);
    },
  });
}

export function useDealsByStage(pipelineId: string | undefined) {
  const { data: deals, ...rest } = useDeals({ pipelineId });

  const dealsByStage = deals?.reduce((acc, deal) => {
    const stage = deal.stage || "Lead Qualification";
    if (!acc[stage]) {
      acc[stage] = [];
    }
    acc[stage].push(deal);
    return acc;
  }, {} as Record<string, Deal[]>) || {};

  return { dealsByStage, deals, ...rest };
}
