import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function ImportDataButton() {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setResult(null);

    try {
      const csvData = await file.text();

      const { data, error } = await supabase.functions.invoke("import-companies", {
        body: { csvData },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        setResult({
          success: true,
          message: `Successfully imported ${data.imported} of ${data.total} companies`,
        });
        toast({
          title: "Import Complete",
          description: `Successfully imported ${data.imported} companies`,
        });
        // Invalidate companies query to refresh the list
        queryClient.invalidateQueries({ queryKey: ["companies"] });
        queryClient.invalidateQueries({ queryKey: ["company-filter-options"] });
      } else {
        throw new Error(data.error || "Import failed");
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
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
      >
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
