import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmailTemplate {
  id: string;
  name: string;
  category: string | null;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  is_default: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  category?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {
  id: string;
}

export function useEmailTemplates(category?: string) {
  return useQuery({
    queryKey: ["email-templates", category],
    queryFn: async () => {
      let query = supabase
        .from("email_templates")
        .select("*")
        .order("name", { ascending: true });

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as EmailTemplate[];
    },
  });
}

export function useEmailTemplate(id: string | null) {
  return useQuery({
    queryKey: ["email-template", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as EmailTemplate;
    },
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      const { data, error } = await supabase
        .from("email_templates")
        .insert({
          name: input.name,
          category: input.category || "general",
          subject: input.subject || "",
          body_html: input.body_html || "",
          body_text: input.body_text || "",
        })
        .select()
        .single();

      if (error) throw error;
      return data as EmailTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create template: " + error.message);
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTemplateInput) => {
      const { id, ...updates } = input;

      const { data, error } = await supabase
        .from("email_templates")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as EmailTemplate;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      queryClient.invalidateQueries({ queryKey: ["email-template", data.id] });
      toast.success("Template updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update template: " + error.message);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete template: " + error.message);
    },
  });
}

export function useDuplicateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First get the original template
      const { data: original, error: fetchError } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Create a copy
      const { data, error } = await supabase
        .from("email_templates")
        .insert({
          name: `${original.name} (Copy)`,
          category: original.category,
          subject: original.subject,
          body_html: original.body_html,
          body_text: original.body_text,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as EmailTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template duplicated");
    },
    onError: (error) => {
      toast.error("Failed to duplicate template: " + error.message);
    },
  });
}
