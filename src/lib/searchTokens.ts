/**
 * Splits a free-text search box query into tokens for a "every word must match
 * somewhere" search — the fix for "Dan Kaminski" finding nothing while "Dan" finds
 * everything. A single ilike.%term% treats the whole query as one literal substring,
 * so a two-word name only matches if it appears verbatim and adjacent in one column;
 * it almost never does. Chaining one .or(...) per token (PostgREST ANDs successive
 * .or() calls together) instead requires each word to appear somewhere across the
 * searched columns, independently.
 *
 * Also strips characters that are structurally significant in PostgREST's filter
 * syntax (`,`, `(`, `)`) so a search term can never be misread as extra filter
 * conditions, and escapes ilike's own wildcards (`%`, `_`) so a literal one in the
 * query is not treated as a wildcard.
 */
export function searchTokens(term: string, maxTokens = 6): string[] {
  return term
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxTokens)
    .map((token) => token.replace(/[,()]/g, "").replace(/[%_\\]/g, (c) => `\\${c}`))
    .filter(Boolean);
}

/**
 * Applies "every word must match somewhere across these columns" to a Supabase query
 * builder. This was the same five lines copy-pasted into every list's search (contacts,
 * companies, deals, ...), each with its own column list and its own chance to be fixed
 * in one place and not the others — which is exactly what happened. One implementation
 * now; a list's search is just its column names.
 */
export function applyTokenSearch<T extends { or: (filter: string) => T }>(
  query: T,
  columns: string[],
  search: string | undefined,
): T {
  let result = query;
  for (const token of searchTokens(search ?? "")) {
    const clause = columns.map((col) => `${col}.ilike.%${token}%`).join(",");
    result = result.or(clause);
  }
  return result;
}
