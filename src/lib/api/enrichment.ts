import { supabase } from "@/integrations/supabase/client";

export async function enrichCompany(companyId: string) {
  const { data, error } = await supabase.functions.invoke("enrich-company", {
    body: { companyId },
  });

  if (error) {
    throw new Error(error.message || "Failed to enrich company");
  }

  if (!data.success) {
    throw new Error(data.error || "Failed to enrich company");
  }

  return data;
}

export async function enrichContact(contactId: string) {
  const { data, error } = await supabase.functions.invoke("enrich-contact", {
    body: { contactId },
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
  onProgress?: (current: number, total: number) => void
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i++) {
    onProgress?.(i + 1, ids.length);
    try {
      await enrichCompany(ids[i]);
      succeeded++;
    } catch {
      failed++;
    }
  }
  return { succeeded, failed };
}

export async function enrichContacts(
  ids: string[],
  onProgress?: (current: number, total: number) => void
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i++) {
    onProgress?.(i + 1, ids.length);
    try {
      await enrichContact(ids[i]);
      succeeded++;
    } catch {
      failed++;
    }
  }
  return { succeeded, failed };
}
