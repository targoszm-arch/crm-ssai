import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Predefined label colors using HSL values
const LABEL_COLORS = [
  { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
  { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800" },
  { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
  { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-800" },
  { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800" },
];

// Get consistent color for a label based on its text
function getLabelColor(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
}

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
          {labelList.map((label, i) => {
            const color = getLabelColor(label);
            return (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border",
                  color.bg, color.text, color.border
                )}
              >
                {label}
                <button
                  type="button"
                  onClick={() => handleRemoveLabel(label)}
                  className="ml-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
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
          {displayLabels.map((label, i) => {
            const color = getLabelColor(label);
            return (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
                  color.bg, color.text, color.border
                )}
              >
                {label}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No labels added</p>
      )}
    </div>
  );
}
