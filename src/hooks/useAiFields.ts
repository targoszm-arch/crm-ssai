import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type AiFieldDefinition = Tables<"ai_field_definitions">;
export type AiFieldValue = Tables<"ai_field_values">;
export type AiFieldEntityType = "company";
export type AiFieldKind = "tier" | "qualifier";

export function useAiFieldDefinitions(entityType: AiFieldEntityType) {
  return useQuery({
    queryKey: ["ai-field-definitions", entityType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_field_definitions")
        .select("*")
        .eq("entity_type", entityType)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as AiFieldDefinition[];
    },
  });
}

/** Every AI field's most recent computed value for one company, keyed by definition id. */
export function useAiFieldValues(companyId: string | undefined) {
  return useQuery({
    queryKey: ["ai-field-values", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_field_values")
        .select("*")
        .eq("company_id", companyId as string);
      if (error) throw error;
      return data as AiFieldValue[];
    },
  });
}

interface CreateAiFieldInput {
  entityType: AiFieldEntityType;
  label: string;
  kind: AiFieldKind;
  tierOptions?: string[];
  promptTemplate: string;
}

function slugify(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
}

export function useCreateAiFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entityType, label, kind, tierOptions, promptTemplate }: CreateAiFieldInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const trimmedLabel = label.trim();
      if (!trimmedLabel) throw new Error("Field name is required");
      if (!promptTemplate.trim()) throw new Error("Criteria / prompt is required");
      if (kind === "tier" && (!tierOptions || tierOptions.filter(Boolean).length < 2)) {
        throw new Error("A tier field needs at least two ordered labels");
      }

      const { data: existing } = await supabase
        .from("ai_field_definitions")
        .select("id")
        .eq("entity_type", entityType);
      const position = existing?.length ?? 0;

      const { data, error } = await supabase
        .from("ai_field_definitions")
        .insert({
          user_id: user.id,
          entity_type: entityType,
          key: slugify(trimmedLabel),
          label: trimmedLabel,
          kind,
          tier_options: kind === "tier" ? (tierOptions ?? []).map((o) => o.trim()).filter(Boolean) : null,
          prompt_template: promptTemplate.trim(),
          position,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") throw new Error("An AI field with that name already exists");
        throw error;
      }
      return data as AiFieldDefinition;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ai-field-definitions", data.entity_type] });
    },
  });
}

export function useUpdateAiFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, label, tierOptions, promptTemplate, active,
    }: { id: string; label?: string; tierOptions?: string[]; promptTemplate?: string; active?: boolean }) => {
      const patch: Record<string, unknown> = {};
      if (label !== undefined) patch.label = label.trim();
      if (tierOptions !== undefined) patch.tier_options = tierOptions.map((o) => o.trim()).filter(Boolean);
      if (promptTemplate !== undefined) patch.prompt_template = promptTemplate.trim();
      if (active !== undefined) patch.active = active;

      const { data, error } = await supabase
        .from("ai_field_definitions")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as AiFieldDefinition;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ai-field-definitions", data.entity_type] });
    },
  });
}

export function useDeleteAiFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (definition: AiFieldDefinition) => {
      const { error } = await supabase.from("ai_field_definitions").delete().eq("id", definition.id);
      if (error) throw error;
      return definition;
    },
    onSuccess: (definition) => {
      queryClient.invalidateQueries({ queryKey: ["ai-field-definitions", definition.entity_type] });
    },
  });
}

/** The single "who's selling" profile injected into every tier (Fit Score-style) AI
 * field's prompt -- offering, ICP, pricing, differentiation, social proof. Qualifier
 * fields don't need it: they're fact-checks about the prospect, not about the seller. */
export function useAiSenderProfile() {
  return useQuery({
    queryKey: ["ai-sender-profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_sender_profile")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as Tables<"ai_sender_profile"> | null;
    },
  });
}

export function useSaveAiSenderProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("ai_sender_profile")
        .upsert({ user_id: user.id, content: content.trim() }, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return data as Tables<"ai_sender_profile">;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-sender-profile"] });
    },
  });
}

export interface ScoreAiFieldsResult {
  definitionId: string;
  key: string;
  label: string;
  value: string | null;
  evidence: string;
}

/** Runs every active AI field for one company through score-ai-fields and refreshes its values. */
export function useScoreCompanyAi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (companyId: string) => {
      const { data, error } = await supabase.functions.invoke("score-ai-fields", {
        body: { companyId },
      });
      if (error) throw new Error(error.message || "Failed to score with AI");
      if (!data?.success) throw new Error(data?.error || "Failed to score with AI");
      return data.results as ScoreAiFieldsResult[];
    },
    onSuccess: (_results, companyId) => {
      queryClient.invalidateQueries({ queryKey: ["ai-field-values", companyId] });
    },
  });
}
