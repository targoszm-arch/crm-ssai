import { useState } from "react";
import { ChevronDown, Filter, Tag, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { LabelBadge } from "@/components/shared/LabelBadge";
import { EmailFilters } from "@/hooks/useEmails";

interface InboxFiltersProps {
  filters: EmailFilters;
  onChange: (filters: EmailFilters) => void;
  availableLabels?: string[];
}

export function InboxFilters({ filters, onChange, availableLabels = [] }: InboxFiltersProps) {
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = Object.values(filters).filter(v => 
    v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  const handleFollowUpChange = (value: "0-3" | "4-7" | "8-30" | undefined) => {
    onChange({ ...filters, followUpDays: value });
    setFollowUpOpen(false);
  };

  const handleLabelToggle = (label: string) => {
    const currentLabels = filters.labels || [];
    const newLabels = currentLabels.includes(label)
      ? currentLabels.filter(l => l !== label)
      : [...currentLabels, label];
    onChange({ ...filters, labels: newLabels.length > 0 ? newLabels : undefined });
  };

  const handleFilterToggle = (key: keyof EmailFilters, value: boolean | null) => {
    const newFilters = { ...filters };
    if (value === null || value === false) {
      delete newFilters[key];
    } else {
      (newFilters as any)[key] = value;
    }
    onChange(newFilters);
  };

  const clearAllFilters = () => {
    onChange({});
  };

  return (
    <div className="flex items-center gap-2">
      {/* Follow-up Status */}
      <Popover open={followUpOpen} onOpenChange={setFollowUpOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={filters.followUpDays ? "secondary" : "outline"}
            size="sm"
            className="gap-1"
          >
            <Clock className="h-3.5 w-3.5" />
            Follow-up Status
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="space-y-1">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              You haven't replied
            </p>
            {[
              { value: "0-3" as const, label: "For 0-3 days" },
              { value: "4-7" as const, label: "For 4-7 days" },
              { value: "8-30" as const, label: "For 8-30 days" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleFollowUpChange(
                  filters.followUpDays === option.value ? undefined : option.value
                )}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                  filters.followUpDays === option.value && "bg-accent"
                )}
              >
                <div className={cn(
                  "h-4 w-4 rounded border flex items-center justify-center",
                  filters.followUpDays === option.value 
                    ? "bg-primary border-primary" 
                    : "border-input"
                )}>
                  {filters.followUpDays === option.value && (
                    <span className="text-primary-foreground text-xs">✓</span>
                  )}
                </div>
                {option.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Labels */}
      <Popover open={labelsOpen} onOpenChange={setLabelsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={(filters.labels?.length ?? 0) > 0 ? "secondary" : "outline"}
            size="sm"
            className="gap-1"
          >
            <Tag className="h-3.5 w-3.5" />
            Labels
            {(filters.labels?.length ?? 0) > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {filters.labels?.length}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {availableLabels.length > 0 ? (
              availableLabels.map((label) => {
                const labelName = label.split(':')[0];
                const isSelected = filters.labels?.includes(labelName);
                return (
                  <button
                    key={label}
                    onClick={() => handleLabelToggle(labelName)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                      isSelected && "bg-accent"
                    )}
                  >
                    <Checkbox checked={isSelected} />
                    <LabelBadge label={label} size="sm" />
                  </button>
                );
              })
            ) : (
              <p className="px-2 py-4 text-sm text-muted-foreground text-center">
                No labels available
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* General Filters */}
      <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={
              filters.isUnread || filters.linkedWithDeal !== undefined || 
              filters.isTracked || filters.hasAttachments || filters.fromContact
                ? "secondary" 
                : "outline"
            }
            size="sm"
            className="gap-1"
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="space-y-1">
            {[
              { key: "isUnread" as const, label: "Unread" },
              { key: "linkedWithDeal" as const, label: "Linked with a deal", value: true },
              { key: "linkedWithDeal" as const, label: "Not linked with a deal", value: false },
              { key: "isTracked" as const, label: "Tracked emails" },
              { key: "hasAttachments" as const, label: "With attachments" },
              { key: "fromContact" as const, label: "From existing contact" },
            ].map((option) => {
              let isActive = false;
              if (option.key === "linkedWithDeal") {
                isActive = filters.linkedWithDeal === option.value;
              } else {
                isActive = Boolean(filters[option.key]);
              }

              return (
                <button
                  key={`${option.key}-${option.value ?? ''}`}
                  onClick={() => {
                    if (option.key === "linkedWithDeal") {
                      handleFilterToggle(option.key, isActive ? null : option.value!);
                    } else {
                      handleFilterToggle(option.key, !isActive);
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                    isActive && "bg-accent"
                  )}
                >
                  <Checkbox checked={isActive} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear all */}
      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="gap-1 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear all
        </Button>
      )}
    </div>
  );
}
