import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  CustomFieldEntityType, useCustomFieldDefinitions,
  useCreateCustomFieldDefinition, useDeleteCustomFieldDefinition,
} from "@/hooks/useCustomFields";

interface CustomFieldsCardProps {
  entityType: CustomFieldEntityType;
  values: Record<string, unknown> | null;
  onSave: (values: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Self-service custom fields for a contact or company. "Add ability to
 * create new fields... like if I want to add new without asking you"
 * (Magda, 22 Sep 2026) -- a field defined here from any record page is
 * immediately available on every record of that entity type, no code
 * change or migration per field.
 */
export function CustomFieldsCard({ entityType, values, onSave }: CustomFieldsCardProps) {
  const { data: definitions = [] } = useCustomFieldDefinitions(entityType);
  const createDefinition = useCreateCustomFieldDefinition();
  const deleteDefinition = useDeleteCustomFieldDefinition();
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<"text" | "number" | "date" | "select">("text");
  const [newOptions, setNewOptions] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const handleAddField = async () => {
    try {
      await createDefinition.mutateAsync({
        entityType,
        label: newLabel,
        fieldType: newType,
        selectOptions: newType === "select" ? newOptions.split(",").map((o) => o.trim()) : undefined,
      });
      toast.success("Field added");
      setNewLabel("");
      setNewType("text");
      setNewOptions("");
      setAddOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add field");
    }
  };

  const handleFieldChange = async (fieldKey: string, value: string) => {
    setSavingKey(fieldKey);
    try {
      await onSave({ ...(values ?? {}), [fieldKey]: value === "" ? null : value });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save field");
    } finally {
      setSavingKey(null);
    }
  };

  const handleDeleteField = async (definition: (typeof definitions)[number]) => {
    if (!window.confirm(`Remove the "${definition.label}" field? This removes it from every ${entityType}, not just this one.`)) return;
    try {
      await deleteDefinition.mutateAsync(definition);
      toast.success("Field removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove field");
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Custom Fields</CardTitle>
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Add custom field">
              <Plus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-field-label" className="text-xs">Field name</Label>
              <Input
                id="new-field-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Renewal month"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as typeof newType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="select">Dropdown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newType === "select" && (
              <div className="space-y-1.5">
                <Label htmlFor="new-field-options" className="text-xs">Options (comma-separated)</Label>
                <Input
                  id="new-field-options"
                  value={newOptions}
                  onChange={(e) => setNewOptions(e.target.value)}
                  placeholder="Option A, Option B, Option C"
                />
              </div>
            )}
            <Button
              size="sm"
              className="w-full"
              onClick={handleAddField}
              disabled={!newLabel.trim() || createDefinition.isPending}
            >
              {createDefinition.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Add field
            </Button>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="space-y-3 p-5 pt-0">
        {definitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No custom fields yet. Use the + button to add one — it will be available on every {entityType}.
          </p>
        ) : (
          definitions.map((definition) => {
            const currentValue = (values?.[definition.field_key] as string | null) ?? "";
            return (
              <div key={definition.id} className="group flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`custom-${definition.field_key}`} className="text-xs text-muted-foreground">
                    {definition.label}
                  </Label>
                  {definition.field_type === "select" ? (
                    <Select
                      value={currentValue || undefined}
                      onValueChange={(v) => handleFieldChange(definition.field_key, v)}
                    >
                      <SelectTrigger id={`custom-${definition.field_key}`}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(definition.select_options ?? []).map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`custom-${definition.field_key}`}
                      type={definition.field_type === "number" ? "number" : definition.field_type === "date" ? "date" : "text"}
                      defaultValue={currentValue}
                      onBlur={(e) => {
                        if (e.target.value !== currentValue) handleFieldChange(definition.field_key, e.target.value);
                      }}
                    />
                  )}
                </div>
                {savingKey === definition.field_key && <Loader2 className="mb-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                <Button
                  variant="ghost"
                  size="icon"
                  className="mb-0.5 h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100"
                  aria-label={`Remove ${definition.label} field`}
                  onClick={() => handleDeleteField(definition)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
