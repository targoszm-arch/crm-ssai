import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Sparkles, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AiFieldDefinition, AiFieldKind,
  useAiFieldDefinitions, useCreateAiFieldDefinition, useUpdateAiFieldDefinition, useDeleteAiFieldDefinition,
} from "@/hooks/useAiFields";

const KIND_LABELS: Record<AiFieldKind, string> = {
  tier: "Tier (ranked labels, e.g. Bronze/Silver/Gold/Platinum)",
  qualifier: "Qualifier (Qualified / Not Qualified)",
};

interface DefinitionFormState {
  label: string;
  kind: AiFieldKind;
  tierOptions: string;
  promptTemplate: string;
}

const emptyForm: DefinitionFormState = { label: "", kind: "qualifier", tierOptions: "", promptTemplate: "" };

function DefinitionModal({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (open: boolean) => void; editing: AiFieldDefinition | null }) {
  const create = useCreateAiFieldDefinition();
  const update = useUpdateAiFieldDefinition();
  const [form, setForm] = useState<DefinitionFormState>(emptyForm);

  // Reset/prefill whenever a different definition is opened for editing, or the
  // "+ Add" dialog is opened fresh.
  const openKey = editing?.id ?? (open ? "new" : "closed");
  const [lastKey, setLastKey] = useState(openKey);
  if (openKey !== lastKey) {
    setLastKey(openKey);
    setForm(
      editing
        ? {
            label: editing.label,
            kind: editing.kind as AiFieldKind,
            tierOptions: (editing.tier_options ?? []).join(", "),
            promptTemplate: editing.prompt_template,
          }
        : emptyForm
    );
  }

  const pending = create.isPending || update.isPending;

  const save = async () => {
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          label: form.label,
          tierOptions: editing.kind === "tier" ? form.tierOptions.split(",") : undefined,
          promptTemplate: form.promptTemplate,
        });
        toast.success("AI field updated");
      } else {
        await create.mutateAsync({
          entityType: "company",
          label: form.label,
          kind: form.kind,
          tierOptions: form.kind === "tier" ? form.tierOptions.split(",") : undefined,
          promptTemplate: form.promptTemplate,
        });
        toast.success("AI field created");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the AI field");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit AI field" : "Add AI field"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-field-label">Field name</Label>
            <Input
              id="ai-field-label"
              placeholder="e.g. Fit Score, Regulatory exposure"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>

          {!editing && (
            <div className="space-y-1.5">
              <Label htmlFor="ai-field-kind">Type</Label>
              <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v as AiFieldKind }))}>
                <SelectTrigger id="ai-field-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABELS) as AiFieldKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.kind === "tier" && (
            <div className="space-y-1.5">
              <Label htmlFor="ai-field-tiers">Tier labels, worst to best (comma-separated)</Label>
              <Input
                id="ai-field-tiers"
                placeholder="Bronze, Silver, Gold, Platinum"
                value={form.tierOptions}
                onChange={(e) => setForm((f) => ({ ...f, tierOptions: e.target.value }))}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ai-field-prompt">
              {form.kind === "tier" ? "Scoring rubric" : "Claim, plus what qualifies and disqualifies it"}
            </Label>
            <Textarea
              id="ai-field-prompt"
              rows={14}
              className="font-mono text-xs"
              placeholder={
                form.kind === "tier"
                  ? "Describe the ICP criteria, change signals, scoring bands and disqualifiers. This is the full rubric the AI will apply -- see the Fit Score field for an example."
                  : "Claim: ...\n\nQUALIFIED IF: ...\n\nNOT QUALIFIED IF: ..."
              }
              value={form.promptTemplate}
              onChange={(e) => setForm((f) => ({ ...f, promptTemplate: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              This is the only part you write -- account data (industry, size, funding, description, custom fields...) is
              attached automatically when the AI scores a company.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {editing ? "Save changes" : "Create field"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AiFieldsSettings() {
  const { data: definitions, isLoading } = useAiFieldDefinitions("company");
  const update = useUpdateAiFieldDefinition();
  const deleteDefinition = useDeleteAiFieldDefinition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AiFieldDefinition | null>(null);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (definition: AiFieldDefinition) => { setEditing(definition); setModalOpen(true); };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Fields</CardTitle>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add AI field
          </Button>
        </div>
        <CardDescription>
          Configure the criteria the AI scores companies against -- a Fit Score tier, or a Qualified/Not
          Qualified signal claim. Turn a field off to leave it out of "Score with AI" without deleting its
          history.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-5 pt-0">
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}

        {!isLoading && (definitions ?? []).length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">No AI fields configured yet.</p>
        )}

        {(definitions ?? []).map((definition) => (
          <div
            key={definition.id}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{definition.label}</span>
                <Badge variant="outline" className="text-[10px]">
                  {definition.kind === "tier" ? (definition.tier_options ?? []).join(" / ") : "Qualified / Not Qualified"}
                </Badge>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Switch
                checked={definition.active}
                onCheckedChange={(checked) => update.mutate({ id: definition.id, active: checked })}
                aria-label={`Toggle ${definition.label}`}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(definition)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{definition.label}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This also removes every AI-scored value already saved for this field, on every company.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => deleteDefinition.mutate(definition)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </CardContent>

      <DefinitionModal open={modalOpen} onOpenChange={setModalOpen} editing={editing} />
    </Card>
  );
}
