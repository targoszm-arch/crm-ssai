import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Mail, FileText } from "lucide-react";
import { Sequence, SequenceStep, useCreateSequence, useUpdateSequence } from "@/hooks/useSequences";
import { useEmailTemplates, EmailTemplate } from "@/hooks/useEmailTemplates";
import { TemplateListModal } from "@/components/templates/TemplateListModal";

interface SequenceBuilderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence?: Sequence | null;
  defaultTriggerType?: string;
}

const triggerTypes = [
  { value: "manual", label: "Manual Enrollment" },
  { value: "new_customer", label: "New Customer" },
  { value: "post_purchase", label: "Post Purchase" },
  { value: "signup", label: "Signup" },
  { value: "content_download", label: "Content Download" },
  { value: "signup_abandonment", label: "Signup Abandonment Recovery" },
];

export function SequenceBuilderSheet({ open, onOpenChange, sequence, defaultTriggerType }: SequenceBuilderSheetProps) {
  const createSequence = useCreateSequence();
  const updateSequence = useUpdateSequence();
  const { data: templates } = useEmailTemplates();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("manual");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [steps, setSteps] = useState<(SequenceStep & { template_id?: string })[]>([]);
  
  // Template selection modal state
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectingForStep, setSelectingForStep] = useState<number | null>(null);

  const isEditing = !!sequence;

  useEffect(() => {
    if (sequence) {
      setName(sequence.name);
      setDescription(sequence.description || "");
      setTriggerType(sequence.trigger_type);
      setFromEmail(sequence.from_email || "");
      setFromName(sequence.from_name || "");
      setSteps(sequence.steps || []);
    } else {
      // Reset form for new sequence
      setName("");
      setDescription("");
      setTriggerType(defaultTriggerType || "manual");
      setFromEmail("");
      setFromName("");
      setSteps([{ day: 0, subject: "", template: "" }]);
    }
  }, [sequence, open, defaultTriggerType]);

  const addStep = () => {
    const lastDay = steps.length > 0 ? steps[steps.length - 1].day : 0;
    setSteps([...steps, { day: lastDay + 3, subject: "", template: "" }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof SequenceStep | "template_id", value: string | number) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const handleSelectTemplate = (stepIndex: number) => {
    setSelectingForStep(stepIndex);
    setTemplateModalOpen(true);
  };

  const handleTemplateSelected = (template: EmailTemplate) => {
    if (selectingForStep !== null) {
      const updated = [...steps];
      updated[selectingForStep] = {
        ...updated[selectingForStep],
        template: template.id,
        template_id: template.id,
        subject: template.subject || updated[selectingForStep].subject,
      };
      setSteps(updated);
    }
    setTemplateModalOpen(false);
    setSelectingForStep(null);
  };

  const getTemplateName = (templateId: string) => {
    const template = templates?.find((t) => t.id === templateId);
    return template?.name || "Select template...";
  };

  const handleSave = async (status: "draft" | "active") => {
    const sequenceData = {
      name,
      description,
      trigger_type: triggerType,
      from_email: fromEmail || null,
      from_name: fromName || null,
      steps,
      status,
    };

    if (isEditing && sequence) {
      await updateSequence.mutateAsync({ id: sequence.id, ...sequenceData });
    } else {
      await createSequence.mutateAsync(sequenceData);
    }

    onOpenChange(false);
  };

  const isPending = createSequence.isPending || updateSequence.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isEditing ? "Edit Sequence" : "Create Sequence"}</SheetTitle>
            <SheetDescription>
              {isEditing
                ? "Modify your email sequence settings and steps."
                : "Build an automated email sequence to engage your contacts."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Sequence Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Welcome Series"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of this sequence..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trigger">Trigger Type</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* From Settings */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">Sender Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fromName">From Name</Label>
                  <Input
                    id="fromName"
                    placeholder="Your Name"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fromEmail">From Email</Label>
                  <Input
                    id="fromEmail"
                    type="email"
                    placeholder="you@example.com"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Steps Builder */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Email Steps</h3>
                <Button type="button" variant="outline" size="sm" onClick={addStep}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Step
                </Button>
              </div>

              {steps.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Mail className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No email steps yet</p>
                  <Button type="button" variant="link" size="sm" onClick={addStep}>
                    Add your first email
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-4 border rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-2 text-muted-foreground pt-2">
                        <GripVertical className="h-4 w-4 cursor-grab" />
                        <span className="text-sm font-medium w-8">#{index + 1}</span>
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Day</Label>
                            <Input
                              type="number"
                              min="0"
                              value={step.day}
                              onChange={(e) => updateStep(index, "day", parseInt(e.target.value) || 0)}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Template</Label>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full h-9 justify-start text-left font-normal"
                              onClick={() => handleSelectTemplate(index)}
                            >
                              <FileText className="h-4 w-4 mr-2 shrink-0" />
                              <span className="truncate">
                                {step.template ? getTemplateName(step.template) : "Select template..."}
                              </span>
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Subject Line (override)</Label>
                          <Input
                            placeholder="Leave empty to use template subject..."
                            value={step.subject}
                            onChange={(e) => updateStep(index, "subject", e.target.value)}
                            className="h-9"
                          />
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeStep(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSave("draft")}
              disabled={isPending || !name}
            >
              Save as Draft
            </Button>
            <Button onClick={() => handleSave("active")} disabled={isPending || !name || steps.length === 0}>
              {isEditing ? "Save & Activate" : "Create & Activate"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <TemplateListModal
        open={templateModalOpen}
        onOpenChange={setTemplateModalOpen}
        onSelectTemplate={handleTemplateSelected}
        selectionMode
      />
    </>
  );
}
