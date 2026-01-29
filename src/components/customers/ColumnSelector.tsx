import { Settings2, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ColumnDefinition, ColumnPreference } from "@/hooks/useColumnPreferences";

interface ColumnSelectorProps {
  columns: ColumnPreference[];
  columnDefinitions: ColumnDefinition[];
  onToggle: (columnId: string) => void;
  onMoveUp: (columnId: string) => void;
  onMoveDown: (columnId: string) => void;
  onReset: () => void;
}

export function ColumnSelector({
  columns,
  columnDefinitions,
  onToggle,
  onMoveUp,
  onMoveDown,
  onReset,
}: ColumnSelectorProps) {
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);
  
  const getLabel = (id: string) => {
    return columnDefinitions.find((c) => c.id === id)?.label || id;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Settings2 className="h-4 w-4 mr-2" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Customize Columns</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-7 px-2 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Toggle visibility and reorder columns
          </p>
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-2 space-y-1">
            {sortedColumns.map((col, index) => (
              <div
                key={col.id}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-accent group"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Checkbox
                    checked={col.visible}
                    onCheckedChange={() => onToggle(col.id)}
                    id={`col-${col.id}`}
                  />
                  <label
                    htmlFor={`col-${col.id}`}
                    className="text-sm cursor-pointer truncate flex-1"
                  >
                    {getLabel(col.id)}
                  </label>
                </div>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onMoveUp(col.id)}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onMoveDown(col.id)}
                    disabled={index === sortedColumns.length - 1}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <Separator />
        <div className="p-3">
          <p className="text-xs text-muted-foreground">
            {columns.filter((c) => c.visible).length} of {columns.length} columns visible
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
