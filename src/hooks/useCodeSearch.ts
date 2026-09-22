import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CodeSearchResult {
  code: string;
  label: string;
}

interface UseCodeSearchOptions {
  /** Table to search — must have RLS allowing select to anyone (both naics_codes and sic_codes do). */
  table: "naics_codes" | "sic_codes";
  codeColumn: string;
  labelColumn: string;
  query: string;
  /** Only runs the query once the popover is open, so typing elsewhere never fires it. */
  enabled: boolean;
}

/**
 * Server-side search for a reference table too large to load client-side (naics_codes has
 * 20,398 rows). Matches on the code (prefix) or the label (substring, via the pg_trgm index),
 * so "541" and "software" both find the same row.
 */
export function useCodeSearch({ table, codeColumn, labelColumn, query, enabled }: UseCodeSearchOptions) {
  const [results, setResults] = useState<CodeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const trimmed = query.trim();
      let request = supabase.from(table).select(`${codeColumn},${labelColumn}`);
      if (trimmed) {
        const escaped = trimmed.replace(/[%_]/g, (m) => `\\${m}`);
        request = request.or(`${codeColumn}.ilike.${escaped}%,${labelColumn}.ilike.%${escaped}%`);
      }
      const { data, error } = await request
        .order(codeColumn, { ascending: true })
        .limit(25);

      if (cancelled) return;
      setLoading(false);
      if (error) {
        setResults([]);
        return;
      }
      setResults(
        ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
          code: String(row[codeColumn] ?? ""),
          label: String(row[labelColumn] ?? ""),
        })),
      );
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [table, codeColumn, labelColumn, query, enabled]);

  return { results, loading };
}
