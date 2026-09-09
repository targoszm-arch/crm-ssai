import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Documents attached to a person or a company.
 *
 * Both keys are written at upload time — a file uploaded against a person also
 * carries that person's company_id — so each view is a single-column query and
 * a file filed on someone shows on their company without any join or
 * inheritance rule. See the crm_files migration.
 */

const BUCKET = "crm-files";

export interface CrmFile {
  id: string;
  contact_id: string | null;
  company_id: string | null;
  name: string;
  path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  /** Filled in for the company view, so a row can say who it came from. */
  contacts?: { first_name: string | null; last_name: string | null } | null;
}

export type FileScope =
  | { contactId: string; companyId?: string | null }
  | { companyId: string; contactId?: null };

function scopeKey(scope: FileScope) {
  return "contactId" in scope && scope.contactId
    ? ["crm_files", "contact", scope.contactId]
    : ["crm_files", "company", (scope as { companyId: string }).companyId];
}

export function useCrmFiles(scope: FileScope | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...(scope ? scopeKey(scope) : ["crm_files", "none"]), user?.id],
    queryFn: async () => {
      let query = supabase
        .from("crm_files")
        .select("id, contact_id, company_id, name, path, mime_type, size_bytes, created_at, contacts:contact_id (first_name, last_name)")
        .order("created_at", { ascending: false });

      query = "contactId" in scope! && scope!.contactId
        ? query.eq("contact_id", (scope as { contactId: string }).contactId)
        : query.eq("company_id", (scope as { companyId: string }).companyId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as CrmFile[];
    },
    enabled: !!user && !!scope,
  });
}

export function useUploadCrmFile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, scope }: { file: File; scope: FileScope }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // The first path segment is the owner, which is what the storage policies
      // check. The uuid prefix keeps two files of the same name apart.
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined });
      if (uploadError) throw uploadError;

      const contactId = "contactId" in scope ? scope.contactId ?? null : null;
      const companyId = scope.companyId ?? null;

      const { error: rowError } = await supabase.from("crm_files").insert({
        user_id: user.id,
        contact_id: contactId,
        company_id: companyId,
        name: file.name,
        path,
        mime_type: file.type || null,
        size_bytes: file.size,
      } as never);

      if (rowError) {
        // Don't leave bytes in the bucket with no row pointing at them — that
        // is storage nobody can see, list or delete from the app.
        await supabase.storage.from(BUCKET).remove([path]);
        throw rowError;
      }

      return path;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_files"] }),
  });
}

export function useDeleteCrmFile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (file: CrmFile) => {
      const { error } = await supabase.from("crm_files").delete().eq("id", file.id);
      if (error) throw error;
      // Best effort: the row is what the UI reads, so an orphaned object is
      // untidy rather than visible.
      await supabase.storage.from(BUCKET).remove([file.path]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_files"] }),
  });
}

/** Signed, because the bucket is private and these are customer documents. */
export async function crmFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
