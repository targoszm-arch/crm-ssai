import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type LeadQualification = Tables<"lead_qualifications">;

export interface DiscoverySection {
  [field: string]: string;
}

export interface DiscoveryData {
  problem_identification: DiscoverySection;
  time_qualification: DiscoverySection;
  cost_qualification: DiscoverySection;
  process_qualification: DiscoverySection;
  success_metrics: DiscoverySection;
  champions_identification: DiscoverySection;
}

export function useLeadQualification(contactId: string | undefined) {
  return useQuery({
    queryKey: ["lead-qualification", contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data, error } = await supabase
        .from("lead_qualifications")
        .select("*")
        .eq("contact_id", contactId)
        .maybeSingle();
      if (error) throw error;
      return data as LeadQualification | null;
    },
    enabled: !!contactId,
  });
}

interface SaveLeadQualificationInput {
  contactId: string;
  companyId?: string | null;
  status: "draft" | "completed";
  discovery: DiscoveryData;
}

/** One row per contact, always upserted in place -- "Form must always be
 * editable" (Magda, 22 Sep 2026), not a new versioned submission every save. */
export function useSaveLeadQualification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, companyId, status, discovery }: SaveLeadQualificationInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("lead_qualifications")
        .upsert(
          {
            contact_id: contactId,
            company_id: companyId ?? null,
            user_id: user.id,
            status,
            completed_at: status === "completed" ? new Date().toISOString() : null,
            problem_identification: discovery.problem_identification,
            time_qualification: discovery.time_qualification,
            cost_qualification: discovery.cost_qualification,
            process_qualification: discovery.process_qualification,
            success_metrics: discovery.success_metrics,
            champions_identification: discovery.champions_identification,
          },
          { onConflict: "contact_id" },
        )
        .select()
        .single();

      if (error) throw error;
      return data as LeadQualification;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lead-qualification", data.contact_id] });
    },
  });
}
