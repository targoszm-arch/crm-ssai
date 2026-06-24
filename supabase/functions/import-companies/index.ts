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
          stage: mapLabel(labelsValue),
        };

        if (i === 1) {
          console.log("First record industry:", industry);
          console.log("First record employee_count:", employeeCount);
          console.log("First record employee_range:", employeeRange);
        }

        if (company.company_name && company.company_name !== "Unknown" && company.company_name !== "-") {
          companies.push(company);
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
      .select("id, company_name")
      .eq("user_id", userId);

    if (fetchError) {
      console.log("Error fetching existing companies:", fetchError.message);
      throw new Error(`Failed to fetch existing companies: ${fetchError.message}`);
    }

    const existingMap = new Map<string, { id: string; company_name: string }>();
    for (const company of existingCompanies || []) {
      const key = company.company_name.toLowerCase().trim();
      if (!existingMap.has(key)) {
        existingMap.set(key, company);
      }
    }

    console.log(`Found ${existingMap.size} unique existing companies by name`);

    const toUpdate: Array<{ id: string; data: typeof companies[0] }> = [];
    const toInsert: typeof companies = [];

    for (const company of companies) {
      const key = company.company_name.toLowerCase().trim();
      const existing = existingMap.get(key);

      if (existing) {
        toUpdate.push({ id: existing.id, data: company });
      } else {
        toInsert.push(company);
      }
    }

    console.log(`To update: ${toUpdate.length}, To insert: ${toInsert.length}`);

    let updated = 0;
    let inserted = 0;

    for (const { id, data } of toUpdate) {
      const { error: updateError } = await supabase
        .from("companies")
        .update({
          ...data,
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

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        inserted,
        deleted,
        total: companies.length,
        rowsParsed: lines.length - 1,
        detectedHeaders: headers.slice(0, 40),
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
