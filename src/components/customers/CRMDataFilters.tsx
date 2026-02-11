import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface CRMDataFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  children?: React.ReactNode;
}

export function CRMDataFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Press Enter to search...",
  onClearFilters,
  hasActiveFilters = false,
  children,
}: CRMDataFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);

  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearchChange(localSearch);
    }
  };

  const handleClearSearch = () => {
    setLocalSearch("");
    onSearchChange("");
  };

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
            onKeyDown={handleKeyDown}
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

        {/* Clear filters button */}
        {hasActiveFilters && onClearFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="mr-1 h-3 w-3" />
            Clear all filters
          </Button>
        )}

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
