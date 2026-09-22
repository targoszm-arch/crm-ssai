import { supabase } from "@/integrations/supabase/client";

export async function scoreCompanyWithAi(companyId: string) {
  const { data, error } = await supabase.functions.invoke("score-ai-fields", {
    body: { companyId },
  });

  if (error) {
    throw new Error(error.message || "Failed to score with AI");
  }

  if (!data.success) {
    throw new Error(data.error || "Failed to score with AI");
  }

  return data;
}

/** Sequential, one company at a time -- an OpenAI call per active AI field, per company,
 * so this is the same "loop with progress" shape as enrichCompanies rather than a single
 * request the edge function would time out trying to serve. */
export async function scoreCompaniesWithAi(
  ids: string[],
  onProgress?: (current: number, total: number) => void
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i++) {
    onProgress?.(i + 1, ids.length);
    try {
      await scoreCompanyWithAi(ids[i]);
      succeeded++;
    } catch {
      failed++;
    }
  }
  return { succeeded, failed };
}
