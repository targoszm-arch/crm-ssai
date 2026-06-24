import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertCircle, Users, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type ImportType = "organizations" | "contacts";

export function ImportDataButton() {
  const [isImporting, setIsImporting] = useState(false);
  const [importType, setImportType] = useState<ImportType | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleImportClick = (type: ImportType) => {
    setImportType(type);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !importType) return;

    setIsImporting(true);
    setResult(null);

    try {
      const csvData = await file.text();

      if (importType === "organizations") {
        // Import organizations - clear existing and replace
        const { data, error } = await supabase.functions.invoke("import-companies", {
          body: { csvData, clearExisting: true },
        });

        if (error) throw new Error(error.message);

        if (data.success) {
          const inserted = data.inserted ?? 0;
          const updated = data.updated ?? 0;
          const saved = inserted + updated;

          if (saved === 0) {
            // Parsed fine but nothing matched — almost always a column-header mismatch.
            setResult({
              success: false,
              message: `0 imported — check CSV column headers`,
            });
            toast({
              title: "No organisations imported",
              description:
                "The file was read but no rows matched. The importer expects Pipedrive-style headers like \"Organization - Name\". Check your column names.",
              variant: "destructive",
            });
          } else {
            setResult({
              success: true,
              message: `Imported ${saved} organisations (${inserted} new, ${updated} updated)`,
            });
            toast({
              title: "Organisations Imported",
              description: `${inserted} new, ${updated} updated${data.deleted ? `, ${data.deleted} removed` : ""}. Now import contacts.`,
            });
          }
          queryClient.invalidateQueries({ queryKey: ["companies"] });
          queryClient.invalidateQueries({ queryKey: ["company-filter-options"] });
        } else {
          throw new Error(data.error || "Import failed");
        }
      } else {
        // Import contacts
        const { data, error } = await supabase.functions.invoke("import-contacts", {
          body: { csvData },
        });

        if (error) throw new Error(error.message);

        if (data.success) {
          setResult({
            success: true,
            message: `Imported ${data.imported} contacts (${data.matched} linked)`,
          });
          toast({
            title: "Contacts Imported",
            description: `Successfully imported ${data.imported} contacts. ${data.matched} linked to organisations.`,
          });
          queryClient.invalidateQueries({ queryKey: ["contacts"] });
          queryClient.invalidateQueries({ queryKey: ["contact-filter-options"] });
          queryClient.invalidateQueries({ queryKey: ["company-contacts"] });
        } else {
          throw new Error(data.error || "Import failed");
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      setResult({ success: false, message });
      toast({
        title: "Import Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportType(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleImportClick("organizations")}>
            <Building2 className="mr-2 h-4 w-4" />
            Import Organisations (Step 1)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleImportClick("contacts")}>
            <Users className="mr-2 h-4 w-4" />
            Import Contacts (Step 2)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {result && (
        <span className={`flex items-center gap-1 text-sm ${result.success ? "text-green-600" : "text-red-600"}`}>
          {result.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {result.message}
        </span>
      )}
    </div>
  );
}
