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

    const { csvData } = await req.json();

    if (!csvData) {
      return new Response(
        JSON.stringify({ error: "CSV data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all companies belonging to this user for matching
    const { data: companiesData, error: companiesError } = await supabase
      .from("companies")
      .select("id, company_name")
      .eq("user_id", userId);

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    const companyMap = new Map<string, string>();
    companiesData?.forEach((company) => {
      if (company.company_name) {
        companyMap.set(company.company_name.toLowerCase().trim(), company.id);
      }
    });

    console.log(`Loaded ${companyMap.size} companies for matching`);

    // Parse CSV — tolerate a BOM, \r\n / \r line endings, and comma/semicolon/tab/pipe delimiters.
    const normalizedCsv = csvData.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
    const lines = normalizedCsv.split("\n");
    const delimiter = detectDelimiter(lines[0]);
    const headers = parseCSVLine(lines[0], delimiter);

    console.log("CSV Headers:", headers.slice(0, 15), "delimiter:", JSON.stringify(delimiter));
    
    const contacts = [];
    const errors = [];
    let matchedCount = 0;

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

        const orgName = pick([
          "Person - Organization", "Organization", "Organisation", "Company", "Company Name",
          "Account", "Account Name", "Employer", "Organization Name",
        ]);
        let companyId: string | null = null;

        if (orgName) {
          companyId = companyMap.get(String(orgName).toLowerCase().trim()) || null;
          if (companyId) matchedCount++;
        }

        // Derive first/last name from explicit columns, or split a full-name column.
        const fullName = pick(["Person - Name", "Full Name", "Name", "Contact Name", "Contact"]);
        const fullParts = fullName ? String(fullName).trim().split(/\s+/) : [];
        const firstName =
          pick(["Person - First name", "First name", "First Name", "Given Name", "Firstname"]) ||
          (fullParts.length ? fullParts[0] : null) ||
          "Unknown";
        const lastName =
          pick(["Person - Last name", "Last name", "Last Name", "Surname", "Family Name", "Lastname"]) ||
          (fullParts.length > 1 ? fullParts.slice(1).join(" ") : null);

        const contact = {
          first_name: firstName,
          last_name: lastName,
          company_id: companyId,
          user_id: userId,
          title: pick(["Person - Job title", "Job title", "Job Title", "Title", "Position", "Role"]),
          email: pick([
            "Person - Email - Work", "Email", "Email Address", "Work Email", "E-mail",
            "Person - Email - Home", "Person - Email - Other", "Email - Work",
          ]),
          phone: cleanPhone(pick([
            "Person - Phone - Mobile", "Phone", "Mobile", "Phone Number", "Telephone", "Cell",
            "Person - Phone - Work", "Person - Phone - Home", "Person - Phone - Other",
          ])),
          work_location: pick(["Person - Country of Postal address", "Country", "Location", "City", "Region"]),
          linkedin_url:
            pick(["Person - LinkedIn URL (Lead CRM)", "LinkedIn", "LinkedIn URL", "LinkedIn profile"]) ||
            buildLinkedInUrl(pick(["Person - linkedin_handle", "LinkedIn Handle", "linkedin_handle"])),
          facebook_url: pick(["Person - Facebook URL", "Facebook URL", "Facebook"]),
          instagram_url: pick(["Person - Instagram URL", "Instagram URL", "Instagram"]),
          last_contacted: parseTimestamp(pick(["Person - Last activity date", "Last activity date", "Last Contacted"])),
          last_email_received: parseTimestamp(pick(["Person - Last email received", "Last email received"])),
          notes: pick(["Person - Personalization_Notes", "Person - Description", "Notes", "Description", "About"]),
          connection_strength: pick(["Person - Connection strength", "Connection strength"]),
          labels: pick(["Person - Labels", "Labels", "Label", "Tags", "Tag"]),
          function: pick(["Person - Function", "Function", "Department"]),
          marketing_status: pick(["Person - Marketing status", "Marketing status", "Marketing Status", "Subscription"]),
          seniority_level: pick(["Person - Seniority level", "Seniority level", "Seniority"]),
          next_recommended_action: pick(["Person - Next recommended action", "Next recommended action"]),
          buying_signals: pick(["Person - Buying signals", "Buying signals"]),
          pain_point: pick(["Person - Pain Point detected", "Pain Point", "Pain point detected"]),
          interest_level: pick(["Person - Interest level", "Interest level"]),
          lqs: parseInt(pick(["Person - LQS", "LQS"])) || null,
          email_messages_count: parseInt(pick(["Person - Email messages count", "Email messages count"])) || 0,
          done_activities: parseInt(pick(["Person - Done activities", "Done activities"])) || 0,
        };

        if (contact.first_name && contact.first_name !== "Unknown") {
          contacts.push(contact);
        }
      } catch (e) {
        errors.push({ line: i, error: e.message });
      }
    }

    console.log(`Parsed ${contacts.length} contacts, ${matchedCount} matched to companies`);

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
