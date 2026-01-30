import { cn } from "@/lib/utils";
import { LABEL_COLORS } from "@/lib/labelColors";

interface LabelBadgeProps {
  label: string;
  colorIndex?: number;
  size?: "sm" | "md";
  onRemove?: () => void;
  className?: string;
}

export function LabelBadge({ 
  label, 
  colorIndex, 
  size = "sm",
  onRemove,
  className 
}: LabelBadgeProps) {
  // Parse label if it contains color index (format: "Label:colorIndex")
  let displayLabel = label;
  let resolvedColorIndex = colorIndex;
  
  if (label.includes(':')) {
    const parts = label.split(':');
    displayLabel = parts[0];
    if (parts[1] && !isNaN(parseInt(parts[1]))) {
      resolvedColorIndex = parseInt(parts[1]);
    }
  }

  // Use deterministic hash for color if no index provided
  if (resolvedColorIndex === undefined) {
    let hash = 0;
    for (let i = 0; i < displayLabel.length; i++) {
      hash = displayLabel.charCodeAt(i) + ((hash << 5) - hash);
    }
    resolvedColorIndex = Math.abs(hash) % LABEL_COLORS.length;
  }

  const color = LABEL_COLORS[resolvedColorIndex % LABEL_COLORS.length];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        className
      )}
      style={{
        backgroundColor: color.bg,
        color: color.text,
      }}
    >
      {displayLabel}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:opacity-70"
        >
          ×
        </button>
      )}
    </span>
  );
}

export function parseLabels(labelsString: string | null | undefined): { label: string; colorIndex: number }[] {
  if (!labelsString) return [];
  
  return labelsString.split(',').filter(Boolean).map(item => {
    const parts = item.trim().split(':');
    const label = parts[0];
    const colorIndex = parts[1] ? parseInt(parts[1]) : undefined;
    
    // Calculate deterministic color if not specified
    let finalColorIndex = colorIndex;
    if (finalColorIndex === undefined) {
      let hash = 0;
      for (let i = 0; i < label.length; i++) {
        hash = label.charCodeAt(i) + ((hash << 5) - hash);
      }
      finalColorIndex = Math.abs(hash) % LABEL_COLORS.length;
    }
    
    return { label, colorIndex: finalColorIndex };
  });
}

export function serializeLabels(labels: { label: string; colorIndex: number }[]): string {
  return labels.map(l => `${l.label}:${l.colorIndex}`).join(',');
}
