import { useState, KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Pencil, Check } from "lucide-react";

interface EditableLabelsProps {
  labels: string | null;
  onSave: (labels: string) => Promise<void>;
  isLoading?: boolean;
}

export function EditableLabels({ labels, onSave, isLoading }: EditableLabelsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [labelList, setLabelList] = useState<string[]>(() => 
    labels ? labels.split(",").map(l => l.trim()).filter(Boolean) : []
  );
  const [newLabel, setNewLabel] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEditing = () => {
    setLabelList(labels ? labels.split(",").map(l => l.trim()).filter(Boolean) : []);
    setIsEditing(true);
  };

  const handleAddLabel = () => {
    const trimmed = newLabel.trim();
    if (trimmed && !labelList.includes(trimmed)) {
      setLabelList([...labelList, trimmed]);
      setNewLabel("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddLabel();
    }
  };

  const handleRemoveLabel = (label: string) => {
    setLabelList(labelList.filter(l => l !== label));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(labelList.join(", "));
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setLabelList(labels ? labels.split(",").map(l => l.trim()).filter(Boolean) : []);
    setNewLabel("");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Labels</h4>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancel} disabled={isSaving}>
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave} disabled={isSaving || isLoading}>
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {labelList.map((label, i) => (
            <Badge key={i} variant="secondary" className="text-xs pr-1 flex items-center gap-1">
              {label}
              <button
                type="button"
                onClick={() => handleRemoveLabel(label)}
                className="ml-1 hover:bg-muted-foreground/20 rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a label..."
            className="h-8 text-sm"
          />
          <Button type="button" size="sm" variant="secondary" onClick={handleAddLabel} disabled={!newLabel.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  const displayLabels = labels ? labels.split(",").map(l => l.trim()).filter(Boolean) : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Labels</h4>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleStartEditing}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
      {displayLabels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {displayLabels.map((label, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No labels added</p>
      )}
    </div>
  );
}
