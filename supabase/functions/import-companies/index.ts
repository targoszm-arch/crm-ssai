import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvData, clearExisting = false } = await req.json();

    if (!csvData) {
      return new Response(
        JSON.stringify({ error: "CSV data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse CSV — tolerate a BOM, \r\n / \r line endings, and comma/semicolon/tab/pipe delimiters.
    const normalizedCsv = csvData.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
    const lines = normalizedCsv.split("\n");
    const delimiter = detectDelimiter(lines[0]);
    const rawHeaders = parseCSVLine(lines[0], delimiter);
    
    // Handle duplicate column names by appending occurrence index
    const headerOccurrences: Record<string, number> = {};
    const headers = rawHeaders.map((header) => {
      const trimmedHeader = header.trim();
      if (headerOccurrences[trimmedHeader] !== undefined) {
        headerOccurrences[trimmedHeader]++;
        return `${trimmedHeader}_${headerOccurrences[trimmedHeader]}`;
      }
      headerOccurrences[trimmedHeader] = 0;
      return trimmedHeader;
    });
    
    console.log("CSV Headers (first 15):", headers.slice(0, 15));
    console.log("Total headers:", headers.length);

    // Custom fields the user defined for companies (e.g. Buying intent score,
    // Buying intent topics, Company signals) -- a CSV column matching a
    // definition's label fills it without a code change or migration per field.
    const { data: customFieldDefs } = await supabase
      .from("custom_field_definitions")
      .select("id, field_key, label, field_type, select_options")
      .eq("entity_type", "company")
      .eq("user_id", userId);

    // Values found in a select/multiselect column that aren't in the field's
    // option list yet -- appended to the definition once, after the import,
    // rather than silently dropping values the CSV actually contains.
    const newOptionsByDefId = new Map<string, Set<string>>();

    function parseCustomFields(pick: (aliases: string[]) => any): Record<string, unknown> {
      const values: Record<string, unknown> = {};
      for (const def of customFieldDefs || []) {
        const raw = pick([def.label]);
        if (raw === null || raw === undefined) continue;
        const value = String(raw).trim();
        if (!value) continue;

        if (def.field_type === "select") {
          const options: string[] = def.select_options || [];
          const match = options.find((o) => o.toLowerCase() === value.toLowerCase());
          if (match) values[def.field_key] = match;
        } else if (def.field_type === "multiselect") {
          const options: string[] = def.select_options || [];
          const resolved: string[] = [];
          for (const part of value.split(/[,;|]/).map((p) => p.trim()).filter(Boolean)) {
            const match = options.find((o) => o.toLowerCase() === part.toLowerCase());
            if (match) {
              resolved.push(match);
            } else {
              resolved.push(part);
              if (!newOptionsByDefId.has(def.id)) newOptionsByDefId.set(def.id, new Set());
              newOptionsByDefId.get(def.id)!.add(part);
            }
          }
          if (resolved.length > 0) values[def.field_key] = resolved;
        } else if (def.field_type === "number") {
          const n = parseFloat(value.replace(/,/g, ""));
          if (!isNaN(n)) values[def.field_key] = n;
        } else if (def.field_type === "checkbox") {
          values[def.field_key] = /^(true|yes|y|1)$/i.test(value);
        } else {
          values[def.field_key] = value;
        }
      }
      return values;
    }

    const companyCustomFields: Record<string, unknown>[] = [];

    const companies: Array<{
      company_name: string;
      user_id: string;
      labels: string | null;
      address: string | null;
      website: string | null;
      linkedin_url: string | null;
      industry: string | null;
      annual_turnover: number | null;
      funding_raised: number | null;
      employee_count: number | null;
      employee_range: string | null;
      people_count: number;
      next_activity_date: string | null;
      done_activities: number;
      email_messages_count: number;
      description: string | null;
      foundation_date: string | null;
      domains: string | null;
      categories: string | null;
      connection_strength: string | null;
      country: string | null;
      client_id: string | null;
      last_interaction: string | null;
      stage: string;
    }> = [];
    const errors: Array<{ line?: number; chunk?: number; error: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      try {
        const values = parseCSVLine(lines[i], delimiter);
        const record: Record<string, any> = {};

        headers.forEach((header, index) => {
          record[header] = values[index] || null;
        });

        // Format-agnostic column lookup (case/space/punctuation-insensitive, with fuzzy fallback).
        const pick = buildPicker(record);

        const industry = pick(["Organization - Industry", "Industry", "Sector", "Vertical"]);

        const rawEmployeeCount = pick([
          "Organization - Number of employees", "Number of employees", "Employees",
          "Employee Count", "Headcount", "Company Size", "Size", "# Employees",
        ]);

        const employeeCount = parseEmployeeCount(rawEmployeeCount);
        const employeeRange = createEmployeeRange(employeeCount);

        const labelsValue = pick(["Organization - Labels", "Labels", "Label", "Tags", "Tag"]);

        const company = {
          company_name: pick([
            "Organization - Name", "Organization Name", "Organisation Name", "Company Name",
            "Account Name", "Organisation", "Organization", "Company", "Account", "Record", "Name",
          ]) || "Unknown",
          user_id: userId,
          labels: labelsValue,
          address: pick(["Organization - Address", "Address", "Street", "Location"]),
          website: pick(["Organization - Website", "Website", "Company Website", "Web", "URL", "Site"]),
          linkedin_url: pick(["Organization - LinkedIn profile", "LinkedIn", "LinkedIn URL", "LinkedIn profile", "LinkedIn Company"]),
          industry: industry,
          annual_turnover: parseRevenue(pick(["Organization - Annual revenue", "Annual revenue", "Revenue", "Turnover", "Annual Turnover"])),
          funding_raised: parseFunding(pick(["Organization - Total Funding", "Total Funding", "Funding raised", "Funding"])),
          employee_count: employeeCount,
          employee_range: employeeRange,
          people_count: parseInt(pick(["Organization - People", "People", "Contacts", "Number of Contacts"])) || 0,
          next_activity_date: parseTimestamp(pick(["Organization - Next activity date", "Next activity date", "Next Activity"])),
          done_activities: parseInt(pick(["Organization - Done activities", "Done activities"])) || 0,
          email_messages_count: parseInt(pick(["Organization - Email messages count", "Email messages count"])) || 0,
          description: pick(["Organization - Description", "Description", "About", "Notes", "Summary"]),
          foundation_date: parseFoundationYear(pick(["Organization - Year Founded", "Year Founded", "Foundation date", "Founded", "Founded Year"])),
          domains: pick(["Domains", "Domain", "Organization - Domain"]),
          categories: pick(["Categories", "Category"]),
          connection_strength: pick(["Connection strength", "Connection Strength"]),
          country: pick(["Organization - Country of Address", "Country", "Primary location > Country", "Country/Region", "HQ Country"]),
          client_id: pick(["Organization - ID", "ID", "Company ID", "Account ID"]),
          last_interaction: parseTimestamp(pick(["Organization - Last activity date", "Last activity date", "Last interaction", "Last Activity"])),
          // An explicit stage column (Apollo's "Account stage", or "Stage")
          // wins when it names a real stage; otherwise fall back to the old
          // labels-based guess so a file with neither still gets something.
          stage: matchStageOption(pick(["Account Stage", "Stage", "Organization - Stage", "Sales Stage"])) ?? mapLabel(labelsValue),
        };

        if (i === 1) {
          console.log("First record industry:", industry);
          console.log("First record employee_count:", employeeCount);
          console.log("First record employee_range:", employeeRange);
        }

        if (company.company_name && company.company_name !== "Unknown" && company.company_name !== "-") {
          companies.push(company);
          companyCustomFields.push(parseCustomFields(pick));
        }
      } catch (e) {
        errors.push({ line: i, error: e.message });
      }
    }

    console.log(`Parsed ${companies.length} companies from CSV`);

    const csvCompanyNames = companies.map(c => c.company_name.toLowerCase().trim());
    const csvCompanyNamesSet = new Set(csvCompanyNames);

    // Only fetch companies belonging to this user
    const { data: existingCompanies, error: fetchError } = await supabase
      .from("companies")
      .select("id, company_name, custom_fields")
      .eq("user_id", userId);

    if (fetchError) {
      console.log("Error fetching existing companies:", fetchError.message);
      throw new Error(`Failed to fetch existing companies: ${fetchError.message}`);
    }

    const existingMap = new Map<string, { id: string; company_name: string; custom_fields: Record<string, unknown> | null }>();
    for (const company of existingCompanies || []) {
      const key = company.company_name.toLowerCase().trim();
      if (!existingMap.has(key)) {
        existingMap.set(key, company);
      }
    }

    console.log(`Found ${existingMap.size} unique existing companies by name`);

    const toUpdate: Array<{ id: string; data: typeof companies[0]; customFields: Record<string, unknown> }> = [];
    const toInsert: Array<typeof companies[0] & { custom_fields: Record<string, unknown> }> = [];

    companies.forEach((company, idx) => {
      const parsedCustomFields = companyCustomFields[idx] || {};
      const key = company.company_name.toLowerCase().trim();
      const existing = existingMap.get(key);

      if (existing) {
        // Merge, don't replace -- a CSV that only carries "Buying intent score"
        // must not wipe out a "Company signals" value set some other way.
        const mergedCustomFields = { ...(existing.custom_fields || {}), ...parsedCustomFields };
        toUpdate.push({ id: existing.id, data: company, customFields: mergedCustomFields });
      } else {
        toInsert.push({ ...company, custom_fields: parsedCustomFields });
      }
    });

    console.log(`To update: ${toUpdate.length}, To insert: ${toInsert.length}`);

    let updated = 0;
    let inserted = 0;

    for (const { id, data, customFields } of toUpdate) {
      const { error: updateError } = await supabase
        .from("companies")
        .update({
          ...data,
          custom_fields: customFields,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId);

      if (updateError) {
        console.log(`Error updating company ${id}:`, updateError.message);
        errors.push({ error: `Update failed for ${data.company_name}: ${updateError.message}` });
      } else {
        updated++;
      }
    }

    console.log(`Updated ${updated} companies`);

    const chunkSize = 100;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);

      const { error } = await supabase
        .from("companies")
        .insert(chunk);

      if (error) {
        console.log(`Error inserting chunk ${i / chunkSize}:`, error.message);
        errors.push({ chunk: i / chunkSize, error: error.message });
      } else {
        inserted += chunk.length;
      }
    }

    console.log(`Inserted ${inserted} new companies`);

    let deleted = 0;
    if (clearExisting) {
      console.log("Cleaning up companies not in CSV...");
      
      const { data: allCompanies } = await supabase
        .from("companies")
        .select("id, company_name")
        .eq("user_id", userId);

      const companiesToDelete: string[] = [];
      for (const company of allCompanies || []) {
        const key = company.company_name.toLowerCase().trim();
        if (!csvCompanyNamesSet.has(key)) {
          companiesToDelete.push(company.id);
        }
      }

      if (companiesToDelete.length > 0) {
        console.log(`Found ${companiesToDelete.length} companies to potentially delete`);

        const { data: companiesWithContacts } = await supabase
          .from("contacts")
          .select("company_id")
          .in("company_id", companiesToDelete);

        const idsWithContacts = new Set((companiesWithContacts || []).map(c => c.company_id));
        const safeToDelete = companiesToDelete.filter(id => !idsWithContacts.has(id));

        console.log(`Safe to delete (no contacts): ${safeToDelete.length}`);

        if (safeToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from("companies")
            .delete()
            .in("id", safeToDelete)
            .eq("user_id", userId);

          if (deleteError) {
            console.log("Error deleting orphan companies:", deleteError.message);
          } else {
            deleted = safeToDelete.length;
            console.log(`Deleted ${deleted} orphan companies`);
          }
        }
      }
    }

    // Grow multiselect custom field option lists with values the CSV actually
    // used, once, rather than per row -- values already matched an option
    // case-insensitively above and were left out of newOptionsByDefId.
    let customFieldOptionsAdded = 0;
    for (const [defId, newValues] of newOptionsByDefId.entries()) {
      const def = (customFieldDefs || []).find((d) => d.id === defId);
      if (!def) continue;
      const merged = Array.from(new Set([...(def.select_options || []), ...newValues]));
      const { error: optionsError } = await supabase
        .from("custom_field_definitions")
        .update({ select_options: merged })
        .eq("id", defId);
      if (optionsError) {
        console.log(`Error growing options for ${def.label}:`, optionsError.message);
      } else {
        customFieldOptionsAdded += newValues.size;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        inserted,
        deleted,
        total: companies.length,
        rowsParsed: lines.length - 1,
        detectedHeaders: headers.slice(0, 40),
        customFieldOptionsAdded,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.log("Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseCSVLine(line: string, delimiter = ","): string[] {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// Pick the most likely delimiter from the header row.
function detectDelimiter(headerLine: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const realCount = headerLine.split(d).length - 1;
    if (realCount > bestCount) {
      bestCount = realCount;
      best = d;
    }
  }
  return best;
}

function normalizeKey(s: string): string {
  return (s ?? "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Returns a lookup that matches a logical field against many header aliases,
// ignoring case/spacing/punctuation, with a fuzzy "contains" fallback.
function buildPicker(record: Record<string, any>) {
  const norm: Record<string, any> = {};
  for (const k of Object.keys(record)) {
    const nk = normalizeKey(k);
    const v = record[k];
    if (nk && (norm[nk] === undefined || norm[nk] === null || norm[nk] === "")) {
      norm[nk] = v;
    }
  }
  const keys = Object.keys(norm);
  return (aliases: string[]): any => {
    for (const a of aliases) {
      const v = norm[normalizeKey(a)];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    for (const a of aliases) {
      const na = normalizeKey(a);
      if (na.length < 4) continue;
      for (const key of keys) {
        if (key.includes(na) || na.includes(key)) {
          const v = norm[key];
          if (v !== undefined && v !== null && String(v).trim() !== "") return v;
        }
      }
    }
    return null;
  };
}

// Kept in sync with src/lib/constants/companyFields.ts SALES_STAGE_OPTIONS --
// Deno functions can't import from src/, so this is a deliberate duplicate.
const SALES_STAGE_OPTIONS = [
  "Discovery", "Contact Made", "Cold Lead", "Warm Lead", "Hot Lead",
  "Marketing Qualified", "Sales Qualified", "Demo Done", "Prospect", "Partner",
];

function matchStageOption(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return SALES_STAGE_OPTIONS.find((option) => option.toLowerCase() === normalized) ?? null;
}

function mapLabel(label: string | null): string {
  if (!label) return "Discovery";
  const lower = label.toLowerCase();
  if (lower.includes("hot")) return "Hot Lead";
  if (lower.includes("warm")) return "Warm Lead";
  if (lower.includes("cold")) return "Cold Lead";
  return "Discovery";
}

function parseRevenue(revenue: string | null): number | null {
  if (!revenue) return null;
  const match = revenue.match(/(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*([BMK])?/i);
  if (!match) return null;
  
  let value = parseFloat(match[1]);
  const multiplier = match[3]?.toUpperCase();
  
  if (multiplier === 'B') value *= 1000000000;
  else if (multiplier === 'M') value *= 1000000;
  else if (multiplier === 'K') value *= 1000;
  
  return value;
}

function parseEmployeeCount(count: string | null): number | null {
  if (!count) return null;
  const parsed = parseInt(count.replace(/,/g, ""));
  return isNaN(parsed) ? null : parsed;
}

function createEmployeeRange(count: number | null): string | null {
  if (!count || count === 0) return null;
  if (count <= 10) return "1-10";
  if (count <= 50) return "11-50";
  if (count <= 200) return "51-200";
  if (count <= 500) return "201-500";
  if (count <= 1000) return "501-1000";
  return "1000+";
}

function parseTimestamp(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

function parseFoundationYear(year: string | null): string | null {
  if (!year) return null;
  try {
    if (/^\d{4}$/.test(year)) {
      return `${year}-01-01`;
    }
    const date = new Date(year);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

function parseFunding(funding: string | null): number | null {
  if (!funding) return null;
  const cleaned = funding.replace(/[$,]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}
