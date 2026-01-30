import React from "react";
import { cn } from "@/lib/utils";

// Predefined label colors using Tailwind classes
export const LABEL_COLORS = [
  { name: "blue", bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800", dot: "bg-blue-500" },
  { name: "green", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800", dot: "bg-green-500" },
  { name: "purple", bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800", dot: "bg-purple-500" },
  { name: "orange", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800", dot: "bg-orange-500" },
  { name: "pink", bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800", dot: "bg-pink-500" },
  { name: "cyan", bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800", dot: "bg-cyan-500" },
  { name: "yellow", bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-800", dot: "bg-yellow-500" },
  { name: "red", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800", dot: "bg-red-500" },
  { name: "indigo", bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800", dot: "bg-indigo-500" },
  { name: "gray", bg: "bg-gray-100 dark:bg-gray-800/50", text: "text-gray-700 dark:text-gray-300", border: "border-gray-200 dark:border-gray-700", dot: "bg-gray-500" },
];

export interface LabelWithColor {
  text: string;
  colorIndex: number;
}

// Parse "label:colorIndex" format, backward compatible with plain labels
export function parseLabel(raw: string): LabelWithColor {
  const parts = raw.split(":");
  if (parts.length >= 2) {
    const colorIndex = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(colorIndex) && colorIndex >= 0 && colorIndex < LABEL_COLORS.length) {
      return { text: parts.slice(0, -1).join(":"), colorIndex };
    }
  }
  // Fallback: hash-based color for backward compatibility
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = raw.charCodeAt(i) + ((hash << 5) - hash);
  }
  return { text: raw, colorIndex: Math.abs(hash) % LABEL_COLORS.length };
}

export function serializeLabel(label: LabelWithColor): string {
  return `${label.text}:${label.colorIndex}`;
}

// Render colored labels from a comma-separated string
export function renderLabels(labelsString: string | null): React.ReactNode {
  if (!labelsString) return "-";
  
  const labels = labelsString.split(",").map(l => parseLabel(l.trim())).filter(l => l.text);
  
  if (labels.length === 0) return "-";
  
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((label, i) => {
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
  );
}
