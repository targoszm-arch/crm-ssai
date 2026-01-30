import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SequenceStep {
  day: number;
  subject: string;
  template: string;
}

export interface Sequence {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  status: string;
  steps: SequenceStep[];
  from_email: string | null;
  from_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  contact_id: string;
  current_step: number;
  status: string;
  enrolled_at: string;
  completed_at: string | null;
  next_email_at: string | null;
  metadata: Record<string, any> | null;
}

export function useSequences(statusFilter?: string) {
  return useQuery({
    queryKey: ["sequences", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("sequences")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching sequences:", error);
        throw error;
      }

      // Parse steps from JSON
      return (data || []).map((seq: any) => ({
        ...seq,
        steps: typeof seq.steps === "string" ? JSON.parse(seq.steps) : seq.steps || [],
      })) as Sequence[];
    },
  });
}

export function useSequenceEnrollments(sequenceId?: string) {
  return useQuery({
    queryKey: ["sequence-enrollments", sequenceId],
    queryFn: async () => {
      let query = supabase
        .from("sequence_enrollments")
        .select(`
          *,
          contacts (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .order("enrolled_at", { ascending: false });

      if (sequenceId) {
        query = query.eq("sequence_id", sequenceId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching enrollments:", error);
        throw error;
      }

      return data;
    },
    enabled: !!sequenceId || sequenceId === undefined,
  });
}

export function useCreateSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sequence: Partial<Sequence>) => {
      const { data, error } = await supabase
        .from("sequences")
        .insert({
          name: sequence.name || "New Sequence",
          description: sequence.description,
          trigger_type: sequence.trigger_type || "manual",
          status: sequence.status || "draft",
          steps: JSON.stringify(sequence.steps || []),
          from_email: sequence.from_email,
          from_name: sequence.from_name,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
      toast.success("Sequence created");
    },
    onError: (error) => {
      console.error("Create sequence error:", error);
      toast.error("Failed to create sequence");
    },
  });
}

export function useUpdateSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Sequence> & { id: string }) => {
      const updateData: Record<string, any> = {
        ...updates,
        updated_at: new Date().toISOString(),
      };
      
      // Convert steps to JSON string if present
      if (updates.steps) {
        updateData.steps = JSON.stringify(updates.steps);
      }
      
      const { data, error } = await supabase
        .from("sequences")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
      toast.success("Sequence updated");
    },
    onError: (error) => {
      console.error("Update sequence error:", error);
      toast.error("Failed to update sequence");
    },
  });
}

export function useEnrollContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sequenceId, contactId }: { sequenceId: string; contactId: string }) => {
      // Get sequence to find first step timing
      const { data: sequence } = await supabase
        .from("sequences")
        .select("steps")
        .eq("id", sequenceId)
        .single();

      const stepsData = sequence?.steps;
      let steps: SequenceStep[] = [];
      if (typeof stepsData === "string") {
        steps = JSON.parse(stepsData);
      } else if (Array.isArray(stepsData)) {
        steps = stepsData as unknown as SequenceStep[];
      }
      const firstStepDay = steps?.[0]?.day || 0;
      const nextEmailAt = new Date();
      nextEmailAt.setDate(nextEmailAt.getDate() + firstStepDay);

      const { data, error } = await supabase
        .from("sequence_enrollments")
        .insert({
          sequence_id: sequenceId,
          contact_id: contactId,
          current_step: 0,
          status: "active",
          next_email_at: nextEmailAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequence-enrollments"] });
      toast.success("Contact enrolled in sequence");
    },
    onError: (error) => {
      console.error("Enroll contact error:", error);
      toast.error("Failed to enroll contact");
    },
  });
}
