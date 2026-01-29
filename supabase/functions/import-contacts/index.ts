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

    const { csvData } = await req.json();

    if (!csvData) {
      return new Response(
        JSON.stringify({ error: "CSV data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all companies to create a lookup map by name
    const { data: companiesData, error: companiesError } = await supabase
      .from("companies")
      .select("id, company_name");

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    // Create a map of company names (lowercase) to IDs for matching
    const companyMap = new Map<string, string>();
    companiesData?.forEach((company) => {
      if (company.company_name) {
        companyMap.set(company.company_name.toLowerCase().trim(), company.id);
      }
    });

    console.log(`Loaded ${companyMap.size} companies for matching`);

    // Parse CSV
    const lines = csvData.split("\n");
    const headers = parseCSVLine(lines[0]);
    
    console.log("CSV Headers:", headers.slice(0, 15));
    
    const contacts = [];
    const errors = [];
    let matchedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      try {
        const values = parseCSVLine(lines[i]);
        const record: Record<string, any> = {};

        headers.forEach((header, index) => {
          record[header] = values[index] || null;
        });

        // Get organization name and find matching company
        const orgName = record["Person - Organization"] || null;
        let companyId: string | null = null;
        
        if (orgName) {
          companyId = companyMap.get(orgName.toLowerCase().trim()) || null;
          if (companyId) matchedCount++;
        }

        // Map all CSV columns to database columns
        const contact = {
          first_name: record["Person - First name"] || record["Person - Name"]?.split(" ")[0] || "Unknown",
          last_name: record["Person - Last name"] || null,
          company_id: companyId,
          title: record["Person - Job title"] || null,
          email: record["Person - Email - Work"] || record["Person - Email - Home"] || record["Person - Email - Other"] || null,
          phone: cleanPhone(record["Person - Phone - Mobile"] || record["Person - Phone - Work"] || record["Person - Phone - Home"] || record["Person - Phone - Other"]),
          work_location: record["Person - Country of Postal address"] || null,
          linkedin_url: record["Person - LinkedIn URL (Lead CRM)"] || buildLinkedInUrl(record["Person - linkedin_handle"]) || null,
          facebook_url: record["Person - Facebook URL"] || null,
          instagram_url: record["Person - Instagram URL"] || null,
          last_contacted: parseTimestamp(record["Person - Last activity date"]),
          last_email_received: parseTimestamp(record["Person - Last email received"]),
          notes: record["Person - Personalization_Notes"] || record["Person - Description"] || null,
          connection_strength: record["Person - Connection strength"] || null,
          labels: record["Person - Labels"] || null,
          function: record["Person - Function"] || null,
          marketing_status: record["Person - Marketing status"] || null,
          seniority_level: record["Person - Seniority level"] || null,
          next_recommended_action: record["Person - Next recommended action"] || null,
          buying_signals: record["Person - Buying signals"] || null,
          pain_point: record["Person - Pain Point detected"] || null,
          interest_level: record["Person - Interest level"] || null,
          lqs: parseInt(record["Person - LQS"]) || null,
          email_messages_count: parseInt(record["Person - Email messages count"]) || 0,
          done_activities: parseInt(record["Person - Done activities"]) || 0,
        };

        // Skip records without a first name
        if (contact.first_name && contact.first_name !== "Unknown") {
          contacts.push(contact);
        }
      } catch (e) {
        errors.push({ line: i, error: e.message });
      }
    }

    console.log(`Parsed ${contacts.length} contacts, ${matchedCount} matched to companies`);

    // Batch insert in chunks of 100
    const chunkSize = 100;
    let inserted = 0;

    for (let i = 0; i < contacts.length; i += chunkSize) {
      const chunk = contacts.slice(i, i + chunkSize);
      
      const { error } = await supabase
        .from("contacts")
        .insert(chunk);

      if (error) {
        console.log(`Error inserting chunk ${i / chunkSize}:`, error.message);
        errors.push({ chunk: i / chunkSize, error: error.message });
      } else {
        inserted += chunk.length;
      }
    }

    console.log(`Inserted ${inserted} contacts`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: inserted,
        total: contacts.length,
        matched: matchedCount,
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

function cleanPhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.replace(/^['"]|['"]$/g, "").trim() || null;
}

function buildLinkedInUrl(handle: string | null): string | null {
  if (!handle) return null;
  if (handle.startsWith("http")) return handle;
  if (handle.startsWith("linkedin.com")) return `https://${handle}`;
  return `https://linkedin.com/in/${handle}`;
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
