import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateCompany, Company } from "@/hooks/useCompanies";
import { CountrySelect } from "@/components/shared/CountrySelect";
import { NaicsCodeSelect } from "@/components/shared/NaicsCodeSelect";
import { SicCodeSelect } from "@/components/shared/SicCodeSelect";
import { INDUSTRY_OPTIONS } from "@/lib/constants/industries";
import { SALES_STAGE_OPTIONS, COMPANY_SIZE_OPTIONS } from "@/lib/constants/companyFields";

/**
 * Editing a company.
 *
 * The Edit company button on the detail page was rendered with no onClick at
 * all — not disabled, inert — so there has been no way to correct a company
 * record from the UI. This is the form behind it.
 *
 * Industry, Sales Stage and Company Size are pickers, not free text --
 * companies.industry alone had 24 distinct real values that never lined up
 * with the (separate) dropdown deals used, and stage/employee_range being
 * free text is how "80" ended up as an employee_range value. Country goes
 * through the same picker as Work Location on a person, resolving to one
 * canonical name instead of "United States"/"US" as two different values.
 */

interface AddCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
}

const emptyValues = {
  company_name: "",
  industry: "",
  website: "",
  domains: "",
  country: "",
  employee_range: "",
  stage: "",
  annual_turnover: "",
  linkedin_url: "",
  description: "",
  naics_code: "",
  naics_description: "",
  sic_code: "",
  sic_title: "",
};

type FormValues = typeof emptyValues;

export function AddCompanyModal({ open, onOpenChange, company }: AddCompanyModalProps) {
  const update = useUpdateCompany();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<FormValues>(emptyValues);

  // Reload whenever a different company is opened: the dialog stays mounted, so
  // state set once would show the previous company's values.
  useEffect(() => {
    if (!open) return;
    setValues({
      company_name: company.company_name ?? "",
      industry: company.industry ?? "",
      website: company.website ?? "",
      domains: company.domains ?? "",
      country: company.country ?? "",
      employee_range: company.employee_range ?? "",
      stage: company.stage ?? "",
      annual_turnover: company.annual_turnover != null ? String(company.annual_turnover) : "",
      linkedin_url: company.linkedin_url ?? "",
      description: company.description ?? "",
      naics_code: company.naics_code ?? "",
      naics_description: company.naics_description ?? "",
      sic_code: company.sic_code ?? "",
      sic_title: company.sic_title ?? "",
    });
  }, [open, company]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    const name = values.company_name.trim();
    if (!name) {
      toast.error("A company needs a name");
      return;
    }

    // Empty means "clear it", so send null rather than an empty string — the
    // filters and the enrichment both test for null, not "".
    const nullify = (v: string) => (v.trim() === "" ? null : v.trim());

    const patch: Partial<Company> = {
      company_name: name,
      industry: nullify(values.industry),
      website: nullify(values.website),
      domains: nullify(values.domains),
      country: nullify(values.country),
      employee_range: nullify(values.employee_range),
      stage: nullify(values.stage),
      annual_turnover: values.annual_turnover.trim() === "" ? null : Number(values.annual_turnover),
      linkedin_url: nullify(values.linkedin_url),
      description: nullify(values.description),
      naics_code: nullify(values.naics_code),
      naics_description: nullify(values.naics_description),
      sic_code: nullify(values.sic_code),
      sic_title: nullify(values.sic_title),
    };

    update.mutate(
      { id: company.id, ...patch },
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
          <div className="space-y-1.5">
            <Label htmlFor="company_name">Company name<span className="text-destructive"> *</span></Label>
            <Input id="company_name" value={values.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry</Label>
            <Select value={values.industry || undefined} onValueChange={(v) => set("industry", v)}>
              <SelectTrigger id="industry"><SelectValue placeholder="Select industry" /></SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input id="website" placeholder="https://" value={values.website} onChange={(e) => set("website", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="domains">Domain</Label>
            <Input id="domains" placeholder="acme.com" value={values.domains} onChange={(e) => set("domains", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <CountrySelect id="country" value={values.country} onChange={(v) => set("country", v)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="employee_range">Company size</Label>
            <Select value={values.employee_range || undefined} onValueChange={(v) => set("employee_range", v)}>
              <SelectTrigger id="employee_range"><SelectValue placeholder="Select company size" /></SelectTrigger>
              <SelectContent>
                {COMPANY_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>{option} employees</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stage">Sales stage</Label>
            <Select value={values.stage || undefined} onValueChange={(v) => set("stage", v)}>
              <SelectTrigger id="stage"><SelectValue placeholder="Select sales stage" /></SelectTrigger>
              <SelectContent>
                {SALES_STAGE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="annual_turnover">Annual revenue (EUR)</Label>
            <Input
              id="annual_turnover"
              type="number"
              min={0}
              step="1000"
              placeholder="0"
              value={values.annual_turnover}
              onChange={(e) => set("annual_turnover", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="naics_code">NAICS code</Label>
            <NaicsCodeSelect
              id="naics_code"
              code={values.naics_code}
              description={values.naics_description}
              onChange={(code, description) => {
                set("naics_code", code);
                set("naics_description", description);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sic_code">SIC code</Label>
            <SicCodeSelect
              id="sic_code"
              code={values.sic_code}
              title={values.sic_title}
              onChange={(code, title) => {
                set("sic_code", code);
                set("sic_title", title);
              }}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="linkedin_url">LinkedIn</Label>
            <Input id="linkedin_url" placeholder="https://linkedin.com/company/…" value={values.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Summary</Label>
            <Textarea id="description" rows={4} value={values.description} onChange={(e) => set("description", e.target.value)} />
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
