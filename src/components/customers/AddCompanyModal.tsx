import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateCompany, Company } from "@/hooks/useCompanies";

/**
 * Editing a company.
 *
 * The Edit company button on the detail page was rendered with no onClick at
 * all — not disabled, inert — so there has been no way to correct a company
 * record from the UI. This is the form behind it.
 *
 * Deliberately the fields someone actually fixes by hand. Enrichment writes the
 * firmographics; a form that lists all 40 columns is a form nobody finishes.
 */

const FIELDS = [
  { key: "company_name", label: "Company name", required: true },
  { key: "industry", label: "Industry" },
  { key: "website", label: "Website", placeholder: "https://" },
  { key: "domains", label: "Domain", placeholder: "acme.com" },
  // No phone or city columns on companies — the detail page renders
  // company.phone, which is why it always shows "Not set".
  { key: "country", label: "Country" },
  { key: "employee_range", label: "Employees", placeholder: "11-50" },
  { key: "linkedin_url", label: "LinkedIn", placeholder: "https://linkedin.com/company/…" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"] | "description";

interface AddCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
}

export function AddCompanyModal({ open, onOpenChange, company }: AddCompanyModalProps) {
  const update = useUpdateCompany();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  // Reload whenever a different company is opened: the dialog stays mounted, so
  // state set once would show the previous company's values.
  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const field of FIELDS) {
      next[field.key] = (company as unknown as Record<string, string | null>)[field.key] ?? "";
    }
    next.description = company.description ?? "";
    setValues(next);
  }, [open, company]);

  const set = (key: FieldKey, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    const name = (values.company_name ?? "").trim();
    if (!name) {
      toast.error("A company needs a name");
      return;
    }

    // Empty means "clear it", so send null rather than an empty string — the
    // filters and the enrichment both test for null, not "".
    const patch: Record<string, string | null> = {};
    for (const key of [...FIELDS.map((f) => f.key), "description"] as FieldKey[]) {
      const value = (values[key] ?? "").trim();
      patch[key] = value === "" ? null : value;
    }
    patch.company_name = name;

    update.mutate(
      { id: company.id, ...(patch as Partial<Company>) },
      {
        onSuccess: () => {
          // The detail page reads its own query key, so refresh that too or the
          // header keeps showing the old name until a reload.
          queryClient.invalidateQueries({ queryKey: ["company-detail", company.id] });
          toast.success("Company updated");
          onOpenChange(false);
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Could not save the company"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit company</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={field.key}>
                {field.label}
                {"required" in field && field.required && (
                  <span className="text-destructive"> *</span>
                )}
              </Label>
              <Input
                id={field.key}
                value={values[field.key] ?? ""}
                placeholder={"placeholder" in field ? field.placeholder : undefined}
                onChange={(e) => set(field.key, e.target.value)}
              />
            </div>
          ))}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Summary</Label>
            <Textarea
              id="description"
              rows={4}
              value={values.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
