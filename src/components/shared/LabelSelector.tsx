import { useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { LabelBadge, parseLabels, serializeLabels } from "./LabelBadge";
import { LABEL_COLORS } from "@/lib/labelColors";
import { cn } from "@/lib/utils";

interface LabelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  availableLabels?: string[];
  placeholder?: string;
  className?: string;
}

export function LabelSelector({
  value,
  onChange,
  availableLabels = [],
  placeholder = "Add labels...",
  className,
}: LabelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);

  const selectedLabels = parseLabels(value);
  const selectedLabelNames = selectedLabels.map(l => l.label.toLowerCase());

  // Get unique labels from availableLabels
  const allLabels = Array.from(new Set([
    ...availableLabels.map(l => {
      const parts = l.split(':');
      return parts[0];
    }),
    ...selectedLabels.map(l => l.label)
  ]));

  const filteredLabels = allLabels.filter(label =>
    label.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleLabel = (label: string) => {
    const existingIndex = selectedLabels.findIndex(
      l => l.label.toLowerCase() === label.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Remove label
      const newLabels = selectedLabels.filter((_, i) => i !== existingIndex);
      onChange(serializeLabels(newLabels));
    } else {
      // Add label with color
      let colorIndex = 0;
      // Try to find existing color for this label
      const existing = availableLabels.find(l => l.split(':')[0].toLowerCase() === label.toLowerCase());
      if (existing && existing.includes(':')) {
        colorIndex = parseInt(existing.split(':')[1]) || 0;
      } else {
        // Generate deterministic color
        let hash = 0;
        for (let i = 0; i < label.length; i++) {
          hash = label.charCodeAt(i) + ((hash << 5) - hash);
        }
        colorIndex = Math.abs(hash) % LABEL_COLORS.length;
      }
      
      const newLabels = [...selectedLabels, { label, colorIndex }];
      onChange(serializeLabels(newLabels));
    }
  };

  const handleAddNewLabel = () => {
    if (!newLabel.trim()) return;
    
    const newLabels = [...selectedLabels, { label: newLabel.trim(), colorIndex: selectedColorIndex }];
    onChange(serializeLabels(newLabels));
    setNewLabel("");
    setSelectedColorIndex((selectedColorIndex + 1) % LABEL_COLORS.length);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-auto min-h-[32px] justify-start", className)}
        >
          {selectedLabels.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedLabels.map((l, i) => (
                <LabelBadge
                  key={i}
                  label={l.label}
                  colorIndex={l.colorIndex}
                  size="sm"
                />
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search labels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredLabels.map((label) => {
              const isSelected = selectedLabelNames.includes(label.toLowerCase());
              return (
                <button
                  key={label}
                  onClick={() => handleToggleLabel(label)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                    isSelected && "bg-accent"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center",
                    isSelected ? "bg-primary border-primary" : "border-input"
                  )}>
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <LabelBadge label={label} size="sm" />
                </button>
              );
            })}
          </div>

          <div className="border-t pt-2">
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="New label..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNewLabel();
                  }
                }}
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAddNewLabel}
                disabled={!newLabel.trim()}
                className="h-8 px-2"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {LABEL_COLORS.slice(0, 8).map((color, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedColorIndex(i)}
                  className={cn(
                    "h-5 w-5 rounded-full border-2",
                    selectedColorIndex === i ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: color.bg }}
                />
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
