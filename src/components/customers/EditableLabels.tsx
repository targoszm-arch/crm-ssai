import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LABEL_COLORS, parseLabel, serializeLabel, type LabelWithColor } from "@/lib/labelColors";

interface EditableLabelsProps {
  labels: string | null;
  onSave: (labels: string) => Promise<void>;
  isLoading?: boolean;
}

export function EditableLabels({ labels, onSave, isLoading }: EditableLabelsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [labelList, setLabelList] = useState<LabelWithColor[]>(() => 
    labels ? labels.split(",").map(l => l.trim()).filter(Boolean).map(parseLabel) : []
  );
  const [newLabel, setNewLabel] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEditing = () => {
    setLabelList(labels ? labels.split(",").map(l => l.trim()).filter(Boolean).map(parseLabel) : []);
    setIsEditing(true);
  };

  const handleAddLabel = () => {
    const trimmed = newLabel.trim();
    if (trimmed && !labelList.some(l => l.text.toLowerCase() === trimmed.toLowerCase())) {
      setLabelList([...labelList, { text: trimmed, colorIndex: newLabelColor }]);
      setNewLabel("");
      setNewLabelColor(0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddLabel();
    }
  };

  const handleRemoveLabel = (text: string) => {
    setLabelList(labelList.filter(l => l.text !== text));
  };

  const handleChangeColor = (text: string, colorIndex: number) => {
    setLabelList(labelList.map(l => l.text === text ? { ...l, colorIndex } : l));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(labelList.map(serializeLabel).join(", "));
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setLabelList(labels ? labels.split(",").map(l => l.trim()).filter(Boolean).map(parseLabel) : []);
    setNewLabel("");
    setNewLabelColor(0);
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
            const color = LABEL_COLORS[label.colorIndex];
            return (
              <Popover key={i}>
                <PopoverTrigger asChild>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity",
                      color.bg, color.text, color.border
                    )}
                  >
                    {label.text}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveLabel(label.text);
                      }}
                      className="ml-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="grid grid-cols-5 gap-1.5">
                    {LABEL_COLORS.map((c, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleChangeColor(label.text, idx)}
                        className={cn(
                          "w-6 h-6 rounded-full transition-all",
                          c.dot,
                          label.colorIndex === idx && "ring-2 ring-offset-2 ring-primary"
                        )}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "w-8 h-8 rounded-md border flex items-center justify-center shrink-0",
                  LABEL_COLORS[newLabelColor].bg,
                  LABEL_COLORS[newLabelColor].border
                )}
              >
                <div className={cn("w-4 h-4 rounded-full", LABEL_COLORS[newLabelColor].dot)} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="grid grid-cols-5 gap-1.5">
                {LABEL_COLORS.map((c, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setNewLabelColor(idx)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all",
                      c.dot,
                      newLabelColor === idx && "ring-2 ring-offset-2 ring-primary"
                    )}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
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

  const displayLabels = labels ? labels.split(",").map(l => l.trim()).filter(Boolean).map(parseLabel) : [];

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
            const color = LABEL_COLORS[label.colorIndex];
            return (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
                  color.bg, color.text, color.border
                )}
              >
                {label.text}
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
