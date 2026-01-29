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

    // Parse CSV
    const lines = csvData.split("\n");
    const rawHeaders = parseCSVLine(lines[0]);
    
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
        const values = parseCSVLine(lines[i]);
        const record: Record<string, any> = {};

        headers.forEach((header, index) => {
          record[header] = values[index] || null;
        });

        // Get industry - prefer first occurrence (non-duplicate), fallback to duplicate if first is empty
        const industry = record["Organization - Industry"] || record["Organization - Industry_1"] || null;
        
        // Get employee count with correct case (lowercase 'e' in 'employees')
        const rawEmployeeCount = record["Organization - Number of employees"] || 
                                  record["Organization - Number of Employees"] || 
                                  record["Organization - Number of employees_1"] || null;
        
        const employeeCount = parseEmployeeCount(rawEmployeeCount);
        const employeeRange = createEmployeeRange(employeeCount);

        // Map all CSV columns to database columns
        const company = {
          company_name: record["Organization - Name"] || record["Record"] || "Unknown",
          labels: record["Organization - Labels"] || null,
          address: record["Organization - Address"] || null,
          website: record["Organization - Website"] || null,
          linkedin_url: record["Organization - LinkedIn profile"] || record["LinkedIn"] || null,
          industry: industry,
          annual_turnover: parseRevenue(record["Organization - Annual revenue"]),
          funding_raised: parseFunding(record["Organization - Total Funding"] || record["Funding raised"]),
          employee_count: employeeCount,
          employee_range: employeeRange,
          people_count: parseInt(record["Organization - People"]) || 0,
          next_activity_date: parseTimestamp(record["Organization - Next activity date"]),
          done_activities: parseInt(record["Organization - Done activities"]) || 0,
          email_messages_count: parseInt(record["Organization - Email messages count"]) || 0,
          description: record["Organization - Description"] || null,
          foundation_date: parseFoundationYear(record["Organization - Year Founded"] || record["Foundation date"]),
          domains: record["Domains"] || record["Organization - Domain"] || null,
          categories: record["Categories"] || null,
          connection_strength: record["Connection strength"] || null,
          country: record["Organization - Country of Address"] || record["Primary location > Country"] || null,
          client_id: record["Organization - ID"] || null,
          last_interaction: parseTimestamp(record["Organization - Last activity date"]),
          stage: mapLabel(record["Organization - Labels"]),
        };

        // Log first record for debugging
        if (i === 1) {
          console.log("First record industry:", industry);
          console.log("First record employee_count:", employeeCount);
          console.log("First record employee_range:", employeeRange);
        }

        // Skip records without a name
        if (company.company_name && company.company_name !== "Unknown" && company.company_name !== "-") {
          companies.push(company);
        }
      } catch (e) {
        errors.push({ line: i, error: e.message });
      }
    }

    console.log(`Parsed ${companies.length} companies from CSV`);

    // Collect all company names from CSV for later cleanup (if clearExisting)
    const csvCompanyNames = companies.map(c => c.company_name.toLowerCase().trim());
    const csvCompanyNamesSet = new Set(csvCompanyNames);

    // UPSERT LOGIC: Match by company_name (case-insensitive)
    // 1. Fetch all existing companies
    const { data: existingCompanies, error: fetchError } = await supabase
      .from("companies")
      .select("id, company_name");

    if (fetchError) {
      console.log("Error fetching existing companies:", fetchError.message);
      throw new Error(`Failed to fetch existing companies: ${fetchError.message}`);
    }

    // Build a map of lowercase company_name -> existing record
    const existingMap = new Map<string, { id: string; company_name: string }>();
    for (const company of existingCompanies || []) {
      const key = company.company_name.toLowerCase().trim();
      // If duplicate names exist, keep the first one found (or you could prefer one with contacts)
      if (!existingMap.has(key)) {
        existingMap.set(key, company);
      }
    }

    console.log(`Found ${existingMap.size} unique existing companies by name`);

    // Separate into updates and inserts
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

    // Perform updates (one at a time to preserve IDs)
    for (const { id, data } of toUpdate) {
      const { error: updateError } = await supabase
        .from("companies")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        console.log(`Error updating company ${id}:`, updateError.message);
        errors.push({ error: `Update failed for ${data.company_name}: ${updateError.message}` });
      } else {
        updated++;
      }
    }

    console.log(`Updated ${updated} companies`);

    // Batch insert new companies in chunks of 100
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

    // If clearExisting is true, delete companies NOT in the CSV
    // BUT only if they have no linked contacts (to prevent orphaning)
    let deleted = 0;
    if (clearExisting) {
      console.log("Cleaning up companies not in CSV...");
      
      // Get all companies that are NOT in the CSV
      const { data: allCompanies } = await supabase
        .from("companies")
        .select("id, company_name");

      const companiesToDelete: string[] = [];
      for (const company of allCompanies || []) {
        const key = company.company_name.toLowerCase().trim();
        if (!csvCompanyNamesSet.has(key)) {
          companiesToDelete.push(company.id);
        }
      }

      if (companiesToDelete.length > 0) {
        console.log(`Found ${companiesToDelete.length} companies to potentially delete`);

        // Check which have contacts - don't delete those
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
            .in("id", safeToDelete);

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

function parseCSVLine(line: string): string[] {
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
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
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
