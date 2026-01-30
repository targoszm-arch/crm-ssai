import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReplyTone = "professional" | "casual" | "brief";

interface GenerateReplyParams {
  emailId: string;
  tone: ReplyTone;
  context?: string;
}

interface GenerateReplyResponse {
  success: boolean;
  reply?: string;
  tone?: string;
  error?: string;
}

export function useGenerateEmailReply() {
  return useMutation({
    mutationFn: async ({ emailId, tone, context }: GenerateReplyParams): Promise<string> => {
      const { data, error } = await supabase.functions.invoke<GenerateReplyResponse>(
        "generate-email-reply",
        {
          body: { emailId, tone, context },
        }
      );

      if (error) {
        throw new Error(error.message || "Failed to generate reply");
      }

      if (!data?.success || !data.reply) {
        throw new Error(data?.error || "No reply generated");
      }

      return data.reply;
    },
  });
}
