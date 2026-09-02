import { supabase } from "@/integrations/supabase/client";

/**
 * Which data source to spend a credit on.
 *
 * "auto" asks Apollo first and only falls back to Hunter.io when Apollo has no match, so
 * the common case costs one credit rather than two. The named providers exist so a bulk
 * run can be pinned to one vendor's billing.
 */
export type EnrichProvider = "auto" | "apollo" | "hunter";

export const ENRICH_PROVIDER_LABELS: Record<EnrichProvider, string> = {
  auto: "Best available",
  apollo: "Apollo",
  hunter: "Hunter.io",
};

export async function enrichCompany(companyId: string, provider: EnrichProvider = "auto") {
  const { data, error } = await supabase.functions.invoke("enrich-company", {
    body: { companyId, provider },
  });

  if (error) {
    throw new Error(error.message || "Failed to enrich company");
  }

  if (!data.success) {
    throw new Error(data.error || "Failed to enrich company");
  }

  return data;
}

export async function enrichContact(contactId: string, provider: EnrichProvider = "auto") {
  const { data, error } = await supabase.functions.invoke("enrich-contact", {
    body: { contactId, provider },
  });

  if (error) {
    throw new Error(error.message || "Failed to enrich contact");
  }

  if (!data.success) {
    throw new Error(data.error || "Failed to enrich contact");
  }

  return data;
}

export async function enrichCompanies(
  ids: string[],
  onProgress?: (current: number, total: number) => void,
  provider: EnrichProvider = "auto"
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i++) {
    onProgress?.(i + 1, ids.length);
    try {
      await enrichCompany(ids[i], provider);
      succeeded++;
    } catch {
      failed++;
    }
  }
  return { succeeded, failed };
}

export async function enrichContacts(
  ids: string[],
  onProgress?: (current: number, total: number) => void,
  provider: EnrichProvider = "auto"
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i++) {
    onProgress?.(i + 1, ids.length);
    try {
      await enrichContact(ids[i], provider);
      succeeded++;
    } catch {
      failed++;
    }
  }
  return { succeeded, failed };
}
