import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * One-off import of the companies Leadfeeder (or Apollo) already found, so the
 * history isn't lost when the subscription is cancelled.
 *
 * Both the official CSV export and the browser-scraped table export are
 * accepted: the scraped one has CSS class names as headers, so the columns are
 * located by their content rather than their title.
 */

interface ImportedRow {
  company_name: string;
  city: string | null;
  industry: string | null;
}

/** Minimal RFC 4180 parser — handles quoted fields containing commas. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function headerIndex(header: string[], patterns: RegExp): number {
  return header.findIndex((cell) => patterns.test(cell.trim()));
}

function extractRows(rows: string[][]): ImportedRow[] {
  if (rows.length < 2) return [];

  const header = rows[0];
  const body = rows.slice(1);

  // Official export: real column titles.
  let nameIdx = headerIndex(header, /^(company|organi[sz]ation|account|lead)\b.*name|^name$|^company$/i);
  let cityIdx = headerIndex(header, /city|location|town/i);
  let industryIdx = headerIndex(header, /industry|sector|vertical/i);

  // Scraped export: headers are CSS class names, but one column holds the
  // Leadfeeder lead URL. The company name sits immediately after it, then the
  // city, then the industry.
  if (nameIdx === -1) {
    const linkIdx = header.findIndex((_, i) =>
      body.some((r) => (r[i] ?? "").includes("leadfeeder.com"))
    );
    if (linkIdx !== -1) {
      nameIdx = linkIdx + 1;
      cityIdx = linkIdx + 2;
      industryIdx = linkIdx + 3;
    }
  }

  if (nameIdx === -1) return [];

  const seen = new Set<string>();
  const out: ImportedRow[] = [];

  for (const r of body) {
    const name = (r[nameIdx] ?? "").trim();
    if (!name || name.includes("leadfeeder.com")) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      company_name: name,
      city: cityIdx >= 0 ? (r[cityIdx] ?? "").trim() || null : null,
      industry: industryIdx >= 0 ? (r[industryIdx] ?? "").trim() || null : null,
    });
  }

  return out;
}

export function ImportLeadfeederCsv() {
  const [isImporting, setIsImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const parsed = extractRows(parseCsv(await file.text()));
      if (parsed.length === 0) {
        toast.error("No companies found", {
          description: "No column in that file looked like a company name.",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // Skip companies already in the CRM so a repeat import can't duplicate.
      const { data: existing } = await supabase
        .from("companies")
        .select("company_name")
        .eq("user_id", user.id);

      const known = new Set(
        (existing ?? []).map((c) => (c.company_name ?? "").trim().toLowerCase()),
      );
      const fresh = parsed.filter((r) => !known.has(r.company_name.toLowerCase()));

      if (fresh.length === 0) {
        toast.info(`All ${parsed.length} companies are already in the CRM.`);
        return;
      }

      const { error } = await supabase.from("companies").insert(
        fresh.map((r) => ({
          user_id: user.id,
          company_name: r.company_name,
          address: r.city,
          industry: r.industry,
          labels: "Website visitor (imported)",
        })) as never,
      );
      if (error) throw error;

      toast.success(`Imported ${fresh.length} companies`, {
        description: `${parsed.length - fresh.length} were already in the CRM. Find them under Customers → Organisations.`,
      });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    } catch (error) {
      toast.error("Import failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleFile}
        className="hidden"
      />
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={isImporting}
      >
        {isImporting
          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          : <Upload className="mr-2 h-4 w-4" />}
        Import Leadfeeder CSV
      </Button>
    </>
  );
}
