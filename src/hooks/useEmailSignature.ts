import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface EmailSignature {
  id: string;
  user_id: string;
  signature_html: string;
  signature_text: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useEmailSignature() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["email-signature", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("email_signatures")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .maybeSingle();

      if (error) throw error;
      return data as EmailSignature | null;
    },
    enabled: !!user?.id,
  });
}

interface SaveSignatureParams {
  signatureHtml: string;
  signatureText: string;
}

export function useSaveEmailSignature() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ signatureHtml, signatureText }: SaveSignatureParams) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Check if signature exists
      const { data: existing } = await supabase
        .from("email_signatures")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("email_signatures")
          .update({
            signature_html: signatureHtml,
            signature_text: signatureText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("email_signatures")
          .insert({
            user_id: user.id,
            signature_html: signatureHtml,
            signature_text: signatureText,
            is_default: true,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-signature"] });
    },
  });
}
