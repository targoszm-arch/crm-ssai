import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Contact } from "@/hooks/useContacts";
import {
  DiscoveryData, DiscoverySection,
  useLeadQualification, useSaveLeadQualification,
} from "@/hooks/useLeadQualifications";

const EMPTY_DISCOVERY: DiscoveryData = {
  problem_identification: { trainingProblem: "", whyProblem: "", whyHappens: "", whyNow: "" },
  time_qualification: {
    trainingFrequency: "", timePerTraining: "", timePerMonth: "", peopleInvolved: "", titles: "",
  },
  cost_qualification: { salaries: "", currentSoftware: "", softwareCosts: "", costPerTraining: "" },
  process_qualification: { previousAttempts: "" },
  success_metrics: {
    companyMeasures: "", peopleImpact: "", currentProcess: "", otherProcesses: "",
    companyImpact: "", dependencies: "", desiredOutcome: "",
  },
  champions_identification: { otherInvolved: "", accountability: "", whoElseAffected: "" },
};

// Same six sections and 18 questions as the "Qualified Sales Leader"
// discovery form this replaces the standalone tool with (sales-leads-crm),
// just scoped to a contact this CRM already knows -- no re-asking company
// name / website / contact title, all of that already lives on the record.
const SECTIONS: {
  key: keyof DiscoveryData;
  title: string;
  fields: { key: string; label: string; placeholder: string; rows?: number }[];
}[] = [
  {
    key: "problem_identification",
    title: "Problem Identification",
    fields: [
      { key: "trainingProblem", label: "What is the company's problem with training?", placeholder: "Describe the training challenges the company is facing..." },
      { key: "whyProblem", label: "Why does the lead think this is a problem?", placeholder: "Explain why they perceive this as a significant issue..." },
      { key: "whyHappens", label: "Why does the lead think this happens?", placeholder: "What do they believe are the root causes..." },
      { key: "whyNow", label: "Why do they have to remedy this now?", placeholder: "What's driving the urgency to solve this problem..." },
    ],
  },
  {
    key: "time_qualification",
    title: "Time Qualification",
    fields: [
      { key: "trainingFrequency", label: "How often do they have to create the training?", placeholder: "Daily, weekly, monthly, quarterly...", rows: 2 },
      { key: "timePerTraining", label: "How long does it take them per training?", placeholder: "Hours or days per training session...", rows: 2 },
      { key: "timePerMonth", label: "How much time does it take them per month/year?", placeholder: "Total time investment per month or year...", rows: 2 },
      { key: "peopleInvolved", label: "How many people are involved in the training creation process?", placeholder: "Number of people and their involvement level...", rows: 2 },
      { key: "titles", label: "What are their titles?", placeholder: "Job titles of people involved...", rows: 2 },
    ],
  },
  {
    key: "cost_qualification",
    title: "Cost Qualification",
    fields: [
      { key: "salaries", label: "What is the salary for each person?", placeholder: "Salary ranges or hourly rates...", rows: 2 },
      { key: "currentSoftware", label: "What software or training providers do they currently use?", placeholder: "Current tools, platforms, or service providers...", rows: 2 },
      { key: "softwareCosts", label: "How much do they pay for each?", placeholder: "Monthly/annual costs for current solutions...", rows: 2 },
      { key: "costPerTraining", label: "How much does it cost them to create each training?", placeholder: "Total cost including time, resources, tools...", rows: 2 },
    ],
  },
  {
    key: "process_qualification",
    title: "Process Qualification",
    fields: [
      { key: "previousAttempts", label: "Have they tried to remedy this previously? How?", placeholder: "Previous solutions attempted and their outcomes..." },
    ],
  },
  {
    key: "success_metrics",
    title: "Success Metrics Identification",
    fields: [
      { key: "companyMeasures", label: "What company measure does this affect?", placeholder: "KPIs, metrics, performance indicators affected...", rows: 2 },
      { key: "peopleImpact", label: "How does this affect their people?", placeholder: "Impact on employees, productivity, satisfaction...", rows: 2 },
      { key: "currentProcess", label: "What is the walkthrough of their current process for creating training?", placeholder: "Step-by-step current training creation process..." },
      { key: "otherProcesses", label: "How does this affect other processes?", placeholder: "Impact on other business processes...", rows: 2 },
      { key: "companyImpact", label: "How is this issue affecting the company?", placeholder: "Overall business impact...", rows: 2 },
      { key: "dependencies", label: "What else does it depend on?", placeholder: "Dependencies, prerequisites, external factors...", rows: 2 },
      { key: "desiredOutcome", label: "What is the company's desired business outcome?", placeholder: "Ideal end state and business objectives..." },
    ],
  },
  {
    key: "champions_identification",
    title: "Champions Identification",
    fields: [
      { key: "otherInvolved", label: "Who else is involved in the process?", placeholder: "Other stakeholders, departments, decision makers...", rows: 2 },
      { key: "accountability", label: "Who is held personally accountable for this measure?", placeholder: "Person responsible for the outcomes...", rows: 2 },
      { key: "whoElseAffected", label: "Who else might this affect?", placeholder: "Other affected parties, influencers, beneficiaries...", rows: 2 },
    ],
  },
];

interface LeadQualificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact;
}

export function LeadQualificationModal({ open, onOpenChange, contact }: LeadQualificationModalProps) {
  const { data: existing } = useLeadQualification(contact.id);
  const save = useSaveLeadQualification();
  const [discovery, setDiscovery] = useState<DiscoveryData>(EMPTY_DISCOVERY);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setDiscovery({
        problem_identification: { ...EMPTY_DISCOVERY.problem_identification, ...(existing.problem_identification as DiscoverySection) },
        time_qualification: { ...EMPTY_DISCOVERY.time_qualification, ...(existing.time_qualification as DiscoverySection) },
        cost_qualification: { ...EMPTY_DISCOVERY.cost_qualification, ...(existing.cost_qualification as DiscoverySection) },
        process_qualification: { ...EMPTY_DISCOVERY.process_qualification, ...(existing.process_qualification as DiscoverySection) },
        success_metrics: { ...EMPTY_DISCOVERY.success_metrics, ...(existing.success_metrics as DiscoverySection) },
        champions_identification: { ...EMPTY_DISCOVERY.champions_identification, ...(existing.champions_identification as DiscoverySection) },
      });
    } else {
      setDiscovery(EMPTY_DISCOVERY);
    }
  }, [open, existing]);

  const updateField = (sectionKey: keyof DiscoveryData, fieldKey: string, value: string) => {
    setDiscovery((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], [fieldKey]: value },
    }));
  };

  const handleSave = (status: "draft" | "completed") => {
    save.mutate(
      { contactId: contact.id, companyId: contact.company_id, status, discovery },
      {
        onSuccess: () => {
          toast.success(status === "completed" ? "Lead qualification completed" : "Draft saved");
          if (status === "completed") onOpenChange(false);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lead Qualification — {[contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-8 py-2">
          {SECTIONS.map((section) => (
            <div key={section.key} className="space-y-4">
              <h3 className="text-sm font-semibold text-primary">{section.title}</h3>
              <div className="space-y-4">
                {section.fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={`${section.key}-${field.key}`}>{field.label}</Label>
                    <Textarea
                      id={`${section.key}-${field.key}`}
                      value={discovery[section.key]?.[field.key] ?? ""}
                      onChange={(e) => updateField(section.key, field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={field.rows ?? 3}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="outline" onClick={() => handleSave("draft")} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save draft
          </Button>
          <Button onClick={() => handleSave("completed")} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Mark complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
