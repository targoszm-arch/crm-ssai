import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface List {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_default: boolean | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  contact_count: number;
  company_count: number;
}

export interface ListMember {
  id: string;
  list_id: string;
  added_at: string;
  contact: {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string | null;
    title: string | null;
  } | null;
  company: {
    id: string;
    company_name: string;
    domain: string | null;
    industry: string | null;
  } | null;
}

export function useLists() {
  return useQuery({
    queryKey: ["lists"],
    queryFn: async (): Promise<List[]> => {
      const { data: lists, error } = await supabase
        .from("lists")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;

      // Counts in one pass rather than a query per list — a sidebar of 20 lists
      // would otherwise fire 20 round trips on every render.
      const { data: members, error: membersError } = await supabase
        .from("list_members")
        .select("list_id, contact_id, company_id");
      if (membersError) throw membersError;

      const counts = new Map<string, { contacts: number; companies: number }>();
      for (const member of members ?? []) {
        const entry = counts.get(member.list_id) ?? { contacts: 0, companies: 0 };
        if (member.contact_id) entry.contacts++;
        if (member.company_id) entry.companies++;
        counts.set(member.list_id, entry);
      }

      return (lists ?? []).map((list) => ({
        ...list,
        contact_count: counts.get(list.id)?.contacts ?? 0,
        company_count: counts.get(list.id)?.companies ?? 0,
      }));
    },
  });
}

export function useListMembers(listId: string | undefined) {
  return useQuery({
    queryKey: ["list-members", listId],
    enabled: !!listId,
    queryFn: async (): Promise<ListMember[]> => {
      const { data, error } = await supabase
        .from("list_members")
        .select(
          `id, list_id, added_at,
           contact:contacts(id, first_name, last_name, email, title),
           company:companies(id, company_name, domain, industry)`
        )
        .eq("list_id", listId!)
        .order("added_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ListMember[];
    },
  });
}

export function useCreateList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; color?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("lists")
        .insert({
          name: input.name,
          description: input.description || null,
          color: input.color || null,
          user_id: auth.user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (list) => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast({ title: "List created", description: list.name });
    },
    onError: (error: Error) =>
      toast({ title: "Could not create list", description: error.message, variant: "destructive" }),
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (listId: string) => {
      // list_members cascades on the foreign key, so the memberships go with it.
      const { error } = await supabase.from("lists").delete().eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast({ title: "List deleted" });
    },
    onError: (error: Error) =>
      toast({ title: "Could not delete list", description: error.message, variant: "destructive" }),
  });
}

export function useAddToList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      listId: string;
      contactIds?: string[];
      companyIds?: string[];
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");

      const contactIds = input.contactIds ?? [];
      const companyIds = input.companyIds ?? [];
      const requested = contactIds.length + companyIds.length;
      if (requested === 0) return { added: 0, requested: 0 };

      // Adding someone already on the list is a no-op, not an error. This cannot be an
      // upsert: uniqueness here comes from two PARTIAL indexes (one per target type), and
      // ON CONFLICT can only infer a partial index if the query repeats its WHERE clause,
      // which PostgREST has no way to send. So read what is already there and insert the
      // difference. The indexes still backstop the data if two tabs race.
      const { data: existing, error: existingError } = await supabase
        .from("list_members")
        .select("contact_id, company_id")
        .eq("list_id", input.listId);
      if (existingError) throw existingError;

      const haveContacts = new Set(
        (existing ?? []).map((m) => m.contact_id).filter(Boolean) as string[]
      );
      const haveCompanies = new Set(
        (existing ?? []).map((m) => m.company_id).filter(Boolean) as string[]
      );

      const rows = [
        ...contactIds
          .filter((id) => !haveContacts.has(id))
          .map((id) => ({ list_id: input.listId, contact_id: id, user_id: auth.user!.id })),
        ...companyIds
          .filter((id) => !haveCompanies.has(id))
          .map((id) => ({ list_id: input.listId, company_id: id, user_id: auth.user!.id })),
      ];
      if (rows.length === 0) return { added: 0, requested };

      const { data, error } = await supabase
        .from("list_members")
        .insert(rows)
        .select("id");
      if (error) throw error;
      return { added: data?.length ?? 0, requested };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["list-members", variables.listId] });
      const skipped = (result.requested ?? 0) - (result.added ?? 0);
      toast({
        title: `Added ${result.added} to list`,
        description: skipped > 0 ? `${skipped} were already on it.` : undefined,
      });
    },
    onError: (error: Error) =>
      toast({ title: "Could not add to list", description: error.message, variant: "destructive" }),
  });
}

export function useRemoveFromList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { listId: string; memberIds: string[] }) => {
      const { error } = await supabase
        .from("list_members")
        .delete()
        .in("id", input.memberIds);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["list-members", variables.listId] });
      toast({ title: "Removed from list" });
    },
    onError: (error: Error) =>
      toast({ title: "Could not remove", description: error.message, variant: "destructive" }),
  });
}
