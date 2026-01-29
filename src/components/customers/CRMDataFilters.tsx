import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Filter } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { MultiSelectFilter, MultiSelectOption } from "./MultiSelectFilter";

export interface MultiSelectFilterConfig {
  key: string;
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

interface CRMDataFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: MultiSelectFilterConfig[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  children?: React.ReactNode;
}

export function CRMDataFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  onClearFilters,
  hasActiveFilters,
  children,
}: CRMDataFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  useEffect(() => {
    if (debouncedSearch !== searchValue) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, searchValue, onSearchChange]);

  const handleClearSearch = () => {
    setLocalSearch("");
    onSearchChange("");
  };

  const activeFilterCount = filters.reduce(
    (count, f) => count + (f.selectedValues.length > 0 ? 1 : 0),
    0
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
        {/* Search Input */}
        <div className="relative w-full lg:w-auto flex-1 max-w-sm">
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
          <div className="flex items-center gap-1 text-muted-foreground">
            <Filter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="text-xs font-medium">({activeFilterCount})</span>
            )}
          </div>
          
          {filters.map((filter) => (
            <MultiSelectFilter
              key={filter.key}
              label={filter.label}
              options={filter.options}
              selectedValues={filter.selectedValues}
              onChange={filter.onChange}
              className="w-[160px]"
            />
          ))}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              <X className="mr-1 h-3 w-3" />
              Clear all
            </Button>
          )}
        </div>

        {/* Additional actions (like column selector) */}
        {children && (
          <div className="flex items-center gap-2 lg:ml-auto">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
