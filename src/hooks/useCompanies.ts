import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type Company = Tables<"companies">;

export interface CompanyFilters {
  search?: string;
  connectionStrength?: string;
  country?: string;
  employeeRange?: string;
}

export interface CompanySorting {
  column: keyof Company | null;
  direction: "asc" | "desc";
}

export function useCompanies(
  filters: CompanyFilters = {},
  sorting: CompanySorting = { column: null, direction: "desc" }
) {
  return useQuery({
    queryKey: ["companies", filters, sorting],
    queryFn: async () => {
      let query = supabase.from("companies").select("*");

      // Apply search filter
      if (filters.search) {
        query = query.or(
          `company_name.ilike.%${filters.search}%,domains.ilike.%${filters.search}%,country.ilike.%${filters.search}%`
        );
      }

      // Apply connection strength filter
      if (filters.connectionStrength) {
        query = query.eq("connection_strength", filters.connectionStrength);
      }

      // Apply country filter
      if (filters.country) {
        query = query.eq("country", filters.country);
      }

      // Apply employee range filter
      if (filters.employeeRange) {
        query = query.eq("employee_range", filters.employeeRange);
      }

      // Apply sorting
      if (sorting.column) {
        query = query.order(sorting.column, { ascending: sorting.direction === "asc" });
      } else {
        query = query.order("last_interaction", { ascending: false, nullsFirst: false });
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Company[];
    },
  });
}

export function useCompanyFilterOptions() {
  return useQuery({
    queryKey: ["company-filter-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("connection_strength, country, employee_range");

      if (error) throw error;

      const connectionStrengths = [...new Set(data?.map((c) => c.connection_strength).filter(Boolean))] as string[];
      const countries = [...new Set(data?.map((c) => c.country).filter(Boolean))] as string[];
      const employeeRanges = [...new Set(data?.map((c) => c.employee_range).filter(Boolean))] as string[];

      return { connectionStrengths, countries, employeeRanges };
    },
  });
}
