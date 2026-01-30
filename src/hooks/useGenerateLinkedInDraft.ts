import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DraftTone = "professional" | "casual" | "brief";

interface GenerateDraftParams {
  messageText: string;
  senderName: string;
  tone: DraftTone;
  context?: string;
}

interface GenerateDraftResponse {
  success: boolean;
  draft?: string;
  error?: string;
}

export function useGenerateLinkedInDraft() {
  return useMutation({
    mutationFn: async ({ messageText, senderName, tone, context }: GenerateDraftParams): Promise<string> => {
      const { data, error } = await supabase.functions.invoke<GenerateDraftResponse>(
        "generate-linkedin-draft",
        {
          body: { messageText, senderName, tone, context },
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
