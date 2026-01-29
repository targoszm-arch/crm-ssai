import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Contact = Tables<"contacts"> & {
  connection_strength?: string;
  facebook_url?: string;
  instagram_url?: string;
  marketing_status?: string;
  last_email_received?: string;
  seniority_level?: string;
  function?: string;
  next_recommended_action?: string;
  buying_signals?: string;
  pain_point?: string;
  interest_level?: string;
  lqs?: number;
  email_messages_count?: number;
  labels?: string;
  done_activities?: number;
};

export type ContactInsert = TablesInsert<"contacts">;

export interface ContactFilters {
  search?: string;
  companyIds?: string[];
  workLocations?: string[];
  titles?: string[];
  seniorityLevels?: string[];
  marketingStatuses?: string[];
  labels?: string[];
}

export interface ContactSorting {
  column: keyof Contact | null;
  direction: "asc" | "desc";
}

export function useContacts(
  filters: ContactFilters = {},
  sorting: ContactSorting = { column: null, direction: "desc" }
) {
  return useQuery({
    queryKey: ["contacts", filters, sorting],
    queryFn: async () => {
      let query = supabase.from("contacts").select("*, companies!contacts_company_id_fkey(company_name)");

      // Apply search filter
      if (filters.search) {
        query = query.or(
          `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        );
      }

      // Apply multi-select filters
      if (filters.companyIds && filters.companyIds.length > 0) {
        query = query.in("company_id", filters.companyIds);
      }

      if (filters.workLocations && filters.workLocations.length > 0) {
        query = query.in("work_location", filters.workLocations);
      }

      if (filters.titles && filters.titles.length > 0) {
        query = query.in("title", filters.titles);
      }

      // Apply sorting
      if (sorting.column) {
        query = query.order(sorting.column, { ascending: sorting.direction === "asc" });
      } else {
        query = query.order("last_contacted", { ascending: false, nullsFirst: false });
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
}

export function useContactFilterOptions() {
  return useQuery({
    queryKey: ["contact-filter-options"],
    queryFn: async () => {
      const [contactsResult, companiesResult] = await Promise.all([
        supabase.from("contacts").select("work_location, title, seniority_level, marketing_status, labels"),
        supabase.from("companies").select("id, company_name"),
      ]);

      if (contactsResult.error) throw contactsResult.error;
      if (companiesResult.error) throw companiesResult.error;

      const workLocations = [...new Set(contactsResult.data?.map((c) => c.work_location).filter(Boolean))] as string[];
      const titles = [...new Set(contactsResult.data?.map((c) => c.title).filter(Boolean))] as string[];
      const seniorityLevels = [...new Set(contactsResult.data?.map((c) => c.seniority_level).filter(Boolean))] as string[];
      const marketingStatuses = [...new Set(contactsResult.data?.map((c) => c.marketing_status).filter(Boolean))] as string[];
      const labels = [...new Set(contactsResult.data?.map((c) => c.labels).filter(Boolean))] as string[];
      const companies = companiesResult.data || [];

      return { workLocations, titles, seniorityLevels, marketingStatuses, labels, companies };
    },
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (contact: ContactInsert) => {
      const { data, error } = await supabase
        .from("contacts")
        .insert(contact)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-filter-options"] });
      queryClient.invalidateQueries({ queryKey: ["company-contacts"] });
    },
  });
}

export function useContactsByCompany(companyId: string | null) {
  return useQuery({
    queryKey: ["company-contacts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("company_id", companyId)
        .order("first_name", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}
