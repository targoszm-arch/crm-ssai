import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DraftTone = "professional" | "casual" | "brief";

interface GenerateDraftParams {
  to: string;
  subject: string;
  tone: DraftTone;
  context?: string;
}

interface GenerateDraftResponse {
  success: boolean;
  draft?: string;
  error?: string;
}

export function useGenerateEmailDraft() {
  return useMutation({
    mutationFn: async ({ to, subject, tone, context }: GenerateDraftParams): Promise<string> => {
      const { data, error } = await supabase.functions.invoke<GenerateDraftResponse>(
        "generate-email-draft",
        {
          body: { to, subject, tone, context },
        }
      );

      if (error) {
        throw new Error(error.message || "Failed to generate draft");
      }

      if (!data?.success || !data.draft) {
        throw new Error(data?.error || "No draft generated");
      }

      return data.draft;
    },
  });
}
