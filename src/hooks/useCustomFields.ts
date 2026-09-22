import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type CustomFieldDefinition = Tables<"custom_field_definitions">;
export type CustomFieldEntityType = "contact" | "company";

export function useCustomFieldDefinitions(entityType: CustomFieldEntityType) {
  return useQuery({
    queryKey: ["custom-field-definitions", entityType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_field_definitions")
        .select("*")
        .eq("entity_type", entityType)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as CustomFieldDefinition[];
    },
  });
}

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "field";
}

export type CustomFieldType = "text" | "number" | "checkbox" | "select" | "multiselect";

interface CreateCustomFieldInput {
  entityType: CustomFieldEntityType;
  label: string;
  fieldType: CustomFieldType;
  selectOptions?: string[];
}

/** Any user defines their own fields from the record page -- "add ability to
 * create new fields in Company and People... without asking you" (Magda, 22
 * Sep 2026) -- no code change, no migration, per field. */
export function useCreateCustomFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entityType, label, fieldType, selectOptions }: CreateCustomFieldInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const trimmedLabel = label.trim();
      if (!trimmedLabel) throw new Error("Field name is required");

      const { data: existing } = await supabase
        .from("custom_field_definitions")
        .select("id")
        .eq("entity_type", entityType);
      const position = existing?.length ?? 0;

      const { data, error } = await supabase
        .from("custom_field_definitions")
        .insert({
          user_id: user.id,
          entity_type: entityType,
          field_key: slugify(trimmedLabel),
          label: trimmedLabel,
          field_type: fieldType,
          select_options: fieldType === "select" ? (selectOptions ?? []).filter(Boolean) : null,
          position,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") throw new Error("A field with that name already exists");
        throw error;
      }
      return data as CustomFieldDefinition;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["custom-field-definitions", data.entity_type] });
    },
  });
}

export function useDeleteCustomFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (definition: CustomFieldDefinition) => {
      const { error } = await supabase
        .from("custom_field_definitions")
        .delete()
        .eq("id", definition.id);
      if (error) throw error;
      return definition;
    },
    onSuccess: (definition) => {
      queryClient.invalidateQueries({ queryKey: ["custom-field-definitions", definition.entity_type] });
    },
  });
}
