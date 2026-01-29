import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type Contact = Tables<"contacts">;

export interface ContactFilters {
  search?: string;
  companyId?: string;
  workLocation?: string;
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
      let query = supabase.from("contacts").select("*, companies(company_name)");

      // Apply search filter
      if (filters.search) {
        query = query.or(
          `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        );
      }

      // Apply company filter
      if (filters.companyId) {
        query = query.eq("company_id", filters.companyId);
      }

      // Apply work location filter
      if (filters.workLocation) {
        query = query.eq("work_location", filters.workLocation);
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
        supabase.from("contacts").select("work_location"),
        supabase.from("companies").select("id, company_name"),
      ]);

      if (contactsResult.error) throw contactsResult.error;
      if (companiesResult.error) throw companiesResult.error;

      const workLocations = [...new Set(contactsResult.data?.map((c) => c.work_location).filter(Boolean))] as string[];
      const companies = companiesResult.data || [];

      return { workLocations, companies };
    },
  });
}
