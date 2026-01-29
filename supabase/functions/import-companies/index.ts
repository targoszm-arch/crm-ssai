import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvData } = await req.json();

    if (!csvData) {
      return new Response(
        JSON.stringify({ error: "CSV data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse CSV
    const lines = csvData.split("\n");
    const headers = parseCSVLine(lines[0]);
    
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

        // Map CSV columns to database columns
        const company = {
          id: record["Record ID"] || undefined,
          company_name: record["Record"] || "Unknown",
          linkedin_url: record["LinkedIn"] || null,
          description: record["Description"] || null,
          country: record["Primary location > Country"] || null,
          foundation_date: record["Foundation date"] ? parseDate(record["Foundation date"]) : null,
          twitter_followers: record["Twitter follower count"] ? parseInt(record["Twitter follower count"]) : null,
          domains: record["Domains"] || null,
          categories: record["Categories"] || null,
          connection_strength: record["Connection strength"] || null,
          last_interaction: record["Last interaction > When"] || null,
          estimated_arr: record["Estimated ARR"] ? parseFloat(record["Estimated ARR"]) : null,
          funding_raised: record["Funding raised"] ? parseFloat(record["Funding raised"]) : null,
          employee_range: record["Employee range"] || null,
        };

        // Skip records without a name
        if (company.company_name && company.company_name !== "Unknown" && company.company_name !== "-") {
          companies.push(company);
        }
      } catch (e) {
        errors.push({ line: i, error: e.message });
      }
    }

    // Batch insert in chunks of 100
    const chunkSize = 100;
    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < companies.length; i += chunkSize) {
      const chunk = companies.slice(i, i + chunkSize);
      
      const { error } = await supabase
        .from("companies")
        .upsert(chunk, { onConflict: "id", ignoreDuplicates: false });

      if (error) {
        errors.push({ chunk: i / chunkSize, error: error.message });
      } else {
        inserted += chunk.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: inserted,
        total: companies.length,
        errors: errors.slice(0, 10), // Return first 10 errors
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
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

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0];
  } catch {
    return null;
  }
}
