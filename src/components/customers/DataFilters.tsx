import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Filter } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

export interface FilterOption {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}

interface DataFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: FilterOption[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function DataFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  onClearFilters,
  hasActiveFilters,
}: DataFiltersProps) {
  // Local state for immediate UI feedback
  const [localSearch, setLocalSearch] = useState(searchValue);
  
  // Debounce the search value - only trigger callback after 300ms of no typing
  const debouncedSearch = useDebounce(localSearch, 300);

  // Sync local state when external value changes (e.g., clear filters)
  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  // Trigger the actual search when debounced value changes
  useEffect(() => {
    if (debouncedSearch !== searchValue) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, searchValue, onSearchChange]);

  const handleClearSearch = () => {
    setLocalSearch("");
    onSearchChange("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-auto flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            className="pl-8 w-full"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          {localSearch && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-9 w-9"
              onClick={handleClearSearch}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {filters.map((filter) => (
            <Select
              key={filter.label}
              value={filter.value}
              onValueChange={filter.onChange}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {filter.label}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              <X className="mr-1 h-3 w-3" />
              Clear filters
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
