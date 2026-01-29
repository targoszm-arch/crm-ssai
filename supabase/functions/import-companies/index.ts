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

    // Clear existing data if requested
    if (clearExisting) {
      console.log("Clearing existing companies data...");
      // First delete contacts to avoid FK constraint issues
      const { error: deleteContactsError } = await supabase.from("contacts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (deleteContactsError) {
        console.log("Error clearing contacts:", deleteContactsError.message);
      }
      const { error: deleteError } = await supabase.from("companies").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (deleteError) {
        console.log("Error clearing companies:", deleteError.message);
      }
    }

    // Parse CSV
    const lines = csvData.split("\n");
    const headers = parseCSVLine(lines[0]);
    
    console.log("CSV Headers:", headers.slice(0, 10));
    
    const companies = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      try {
        const values = parseCSVLine(lines[i]);
        const record: Record<string, any> = {};

        headers.forEach((header, index) => {
          record[header] = values[index] || null;
        });

        // Map new CSV columns to database columns
        const company = {
          company_name: record["Organization - Name"] || record["Record"] || "Unknown",
          stage: mapLabel(record["Organization - Labels"]),
          country: record["Organization - Country of Address"] || record["Primary location > Country"] || null,
          website: record["Organization - Website"] || null,
          linkedin_url: record["Organization - LinkedIn profile"] || record["LinkedIn"] || null,
          industry: record["Organization - Industry"] || null,
          annual_turnover: parseRevenue(record["Organization - Annual revenue"]),
          employee_count: parseEmployeeCount(record["Organization - Number of employees"]),
          client_id: record["Organization - ID"] || null,
          last_interaction: parseTimestamp(record["Organization - Last activity date"]),
          description: record["Organization - Description"] || record["Organization - Address"] || null,
          foundation_date: parseFoundationYear(record["Organization - Year Founded"] || record["Foundation date"]),
          funding_raised: parseFunding(record["Organization - Total Funding"] || record["Funding raised"]),
          employee_range: record["Organization - Number of Employees"] || record["Employee range"] || null,
          domains: record["Domains"] || null,
          categories: record["Categories"] || null,
          connection_strength: record["Connection strength"] || null,
        };

        // Skip records without a name
        if (company.company_name && company.company_name !== "Unknown" && company.company_name !== "-") {
          companies.push(company);
        }
      } catch (e) {
        errors.push({ line: i, error: e.message });
      }
    }

    console.log(`Parsed ${companies.length} companies from CSV`);

    // Batch insert in chunks of 100
    const chunkSize = 100;
    let inserted = 0;

    for (let i = 0; i < companies.length; i += chunkSize) {
      const chunk = companies.slice(i, i + chunkSize);
      
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

    console.log(`Inserted ${inserted} companies`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: inserted,
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
  // Parse strings like "10+B USD", "1 - 10B USD", "100 - 1000M USD"
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
    // Handle year-only format
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
