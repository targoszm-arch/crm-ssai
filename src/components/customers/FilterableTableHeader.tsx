import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ArrowUp, ArrowDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterableTableHeaderProps {
  label: string;
  columnId: string;
  // Sorting
  sortable?: boolean;
  currentSort?: { column: string; direction: "asc" | "desc" } | null;
  onSort?: (direction: "asc" | "desc") => void;
  // Filtering  
  filterable?: boolean;
  filterOptions?: FilterOption[];
  selectedFilterValues?: string[];
  onFilterChange?: (values: string[]) => void;
}

export function FilterableTableHeader({
  label,
  columnId,
  sortable = false,
  currentSort,
  onSort,
  filterable = false,
  filterOptions = [],
  selectedFilterValues = [],
  onFilterChange,
}: FilterableTableHeaderProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const isActive = selectedFilterValues.length > 0;
  const isSortedAsc = currentSort?.column === columnId && currentSort.direction === "asc";
  const isSortedDesc = currentSort?.column === columnId && currentSort.direction === "desc";

  const handleToggleValue = (value: string) => {
    if (!onFilterChange) return;
    
    const newValues = selectedFilterValues.includes(value)
      ? selectedFilterValues.filter((v) => v !== value)
      : [...selectedFilterValues, value];
    
    onFilterChange(newValues);
  };

  const handleSelectAll = () => {
    if (!onFilterChange) return;
    onFilterChange(filterOptions.map((o) => o.value));
  };

  const handleClearFilter = () => {
    if (!onFilterChange) return;
    onFilterChange([]);
  };

  const filteredOptions = filterOptions.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  // If not sortable and not filterable, just render plain label
  if (!sortable && !filterable) {
    return <span className="font-medium">{label}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "p-0 h-auto font-medium hover:bg-transparent flex items-center gap-1",
            isActive && "text-primary"
          )}
        >
          {label}
          {isActive && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {selectedFilterValues.length}
            </Badge>
          )}
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command shouldFilter={false}>
          {/* Sort options */}
          {sortable && onSort && (
            <>
              <CommandGroup heading="Sort">
                <CommandItem
                  onSelect={() => {
                    onSort("asc");
                  }}
                  className="flex items-center gap-2"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  Sort A-Z
                  {isSortedAsc && <Check className="ml-auto h-3.5 w-3.5" />}
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    onSort("desc");
                  }}
                  className="flex items-center gap-2"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  Sort Z-A
                  {isSortedDesc && <Check className="ml-auto h-3.5 w-3.5" />}
                </CommandItem>
              </CommandGroup>
            </>
          )}

          {/* Filter options */}
          {filterable && filterOptions.length > 0 && (
            <>
              {sortable && <CommandSeparator />}
              <CommandGroup heading="Filter">
                <div className="px-2 pb-2">
                  <CommandInput
                    placeholder="Search..."
                    value={search}
                    onValueChange={setSearch}
                    className="h-8"
                  />
                </div>
                <CommandList className="max-h-[200px]">
                  <CommandEmpty>No results found.</CommandEmpty>
                  {filteredOptions.map((option) => {
                    const isSelected = selectedFilterValues.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        onSelect={() => handleToggleValue(option.value)}
                        className="flex items-center gap-2"
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <span className="truncate">{option.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandList>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <div className="flex items-center gap-1 px-1 py-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={handleSelectAll}
                  >
                    Select all
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={handleClearFilter}
                    disabled={!isActive}
                  >
                    Clear
                  </Button>
                </div>
              </CommandGroup>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
