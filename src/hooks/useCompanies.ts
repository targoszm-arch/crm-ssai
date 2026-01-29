import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type Company = Tables<"companies"> & {
  people_count?: number;
  next_activity_date?: string;
  done_activities?: number;
  email_messages_count?: number;
  labels?: string;
  address?: string;
};

export interface CompanyFilters {
  search?: string;
  connectionStrengths?: string[];
  countries?: string[];
  employeeRanges?: string[];
  industries?: string[];
  labels?: string[];
  revenues?: string[];
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

      // Apply multi-select filters
      if (filters.connectionStrengths && filters.connectionStrengths.length > 0) {
        query = query.in("connection_strength", filters.connectionStrengths);
      }

      if (filters.countries && filters.countries.length > 0) {
        query = query.in("country", filters.countries);
      }

      if (filters.employeeRanges && filters.employeeRanges.length > 0) {
        query = query.in("employee_range", filters.employeeRanges);
      }

      if (filters.industries && filters.industries.length > 0) {
        query = query.in("industry", filters.industries);
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
      const { data, error } = await supabase
        .from("companies")
        .select("connection_strength, country, employee_range, industry, labels, annual_turnover");

      if (error) throw error;

      const connectionStrengths = [...new Set(data?.map((c) => c.connection_strength).filter(Boolean))] as string[];
      const countries = [...new Set(data?.map((c) => c.country).filter(Boolean))] as string[];
      const employeeRanges = [...new Set(data?.map((c) => c.employee_range).filter(Boolean))] as string[];
      const industries = [...new Set(data?.map((c) => c.industry).filter(Boolean))] as string[];
      const labels = [...new Set(data?.map((c) => c.labels).filter(Boolean))] as string[];
      
      // Create revenue ranges
      const revenueRanges = [
        { label: "< $1M", value: "0-1000000" },
        { label: "$1M - $10M", value: "1000000-10000000" },
        { label: "$10M - $100M", value: "10000000-100000000" },
        { label: "$100M - $1B", value: "100000000-1000000000" },
        { label: "> $1B", value: "1000000000-999999999999" },
      ];

      return { connectionStrengths, countries, employeeRanges, industries, labels, revenueRanges };
    },
  });
}
