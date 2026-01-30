import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string;
  is_won: boolean;
  is_lost: boolean;
  created_at: string;
}

export function usePipelines() {
  return useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as Pipeline[];
    },
  });
}

export function usePipelineStages(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ["pipeline-stages", pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];
      
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_id", pipelineId)
        .order("position", { ascending: true });
      
      if (error) throw error;
      return data as PipelineStage[];
    },
    enabled: !!pipelineId,
  });
}

export function useCreatePipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("pipelines")
        .insert({ name })
        .select()
        .single();
      
      if (error) throw error;
      return data as Pipeline;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      toast.success("Pipeline created");
    },
    onError: (error) => {
      toast.error("Failed to create pipeline: " + error.message);
    },
  });
}

export function useUpdatePipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from("pipelines")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Pipeline;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      toast.success("Pipeline updated");
    },
    onError: (error) => {
      toast.error("Failed to update pipeline: " + error.message);
    },
  });
}

export function useCreatePipelineStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stage: Omit<PipelineStage, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .insert(stage)
        .select()
        .single();
      
      if (error) throw error;
      return data as PipelineStage;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-stages", variables.pipeline_id] });
      toast.success("Stage created");
    },
    onError: (error) => {
      toast.error("Failed to create stage: " + error.message);
    },
  });
}

export function useUpdatePipelineStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PipelineStage> & { id: string }) => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data as PipelineStage;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-stages", data.pipeline_id] });
    },
    onError: (error) => {
      toast.error("Failed to update stage: " + error.message);
    },
  });
}

export function useDeletePipelineStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, pipelineId }: { id: string; pipelineId: string }) => {
      const { error } = await supabase
        .from("pipeline_stages")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      return { id, pipelineId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-stages", data.pipelineId] });
      toast.success("Stage deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete stage: " + error.message);
    },
  });
}

export function useReorderPipelineStages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stages, pipelineId }: { stages: { id: string; position: number }[]; pipelineId: string }) => {
      const updates = stages.map(stage => 
        supabase
          .from("pipeline_stages")
          .update({ position: stage.position })
          .eq("id", stage.id)
      );
      
      await Promise.all(updates);
      return pipelineId;
    },
    onSuccess: (pipelineId) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-stages", pipelineId] });
    },
    onError: (error) => {
      toast.error("Failed to reorder stages: " + error.message);
    },
  });
}
