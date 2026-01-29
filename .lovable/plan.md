

# Plan: Move Filters into Table Headers

## Overview

This plan removes the external filter bar and integrates filtering directly into the table column headers. Clicking on a column header will open a dropdown with filter options for that column, combining sorting and filtering in one place.

---

## Current vs New Approach

### Before (Current)
```text
+----------------------------------------------------------+
| Search: [___________]  [Country v] [Industry v] [Labels v]|
+----------------------------------------------------------+
| Name        | Industry    | Country   | Connection        |
| Acme Corp   | Technology  | USA       | Strong            |
| Beta Inc    | Finance     | UK        | Weak              |
+----------------------------------------------------------+
```

### After (New)
```text
+----------------------------------------------------------+
| Search: [___________]                    [Columns Settings]|
+----------------------------------------------------------+
| Name [v]     | Industry [v]  | Country [v] | Connection [v]|
|   Sort A-Z   |   Sort A-Z    |   Sort A-Z  |   Sort A-Z    |
|   Sort Z-A   |   Sort Z-A    |   Sort Z-A  |   Sort Z-A    |
|   --------   |   --------    |   --------  |   --------    |
|   [ ] All    |   [ ] All     |   [ ] All   |   [ ] All     |
|   [x] Tech   |   [x] Ireland |   [x] Strong|               |
|   [ ] Fin.   |   [ ] USA     |   [ ] Weak  |               |
+----------------------------------------------------------+
| Acme Corp    | Technology   | USA        | Strong          |
| Beta Inc     | Finance      | UK         | Weak            |
+----------------------------------------------------------+
```

---

## What We'll Build

### 1. FilterableTableHeader Component
A new component that renders as a table header cell with:
- Column label with dropdown trigger (chevron icon)
- Popover with sort options (A-Z, Z-A)
- Multi-select checkboxes for filtering values
- Clear filter button
- Visual indicator when filter is active

### 2. Updated DataTable Component
Modify the DataTable to accept a more flexible header definition that can include filterable headers.

### 3. Simplified Filter Bar
Keep only:
- Search input (with debouncing)
- Column selector button
- Clear all filters button (shown when any header filter is active)

---

## Technical Implementation

### New Component: FilterableTableHeader

```typescript
interface FilterableTableHeaderProps {
  label: string;
  columnId: string;
  // Sorting
  sortable?: boolean;
  currentSort?: { column: string; direction: "asc" | "desc" } | null;
  onSort?: (direction: "asc" | "desc") => void;
  // Filtering  
  filterable?: boolean;
  filterOptions?: { label: string; value: string }[];
  selectedFilterValues?: string[];
  onFilterChange?: (values: string[]) => void;
}
```

### Column Definition Updates

Each column will optionally include filter configuration:

```typescript
{
  id: "country",
  accessorKey: "country",
  header: <FilterableTableHeader
    label="Country"
    columnId="country"
    sortable={true}
    filterable={true}
    filterOptions={countryOptions}
    selectedFilterValues={filters.countries}
    onFilterChange={(values) => setFilters({ ...filters, countries: values })}
  />,
  cell: (company) => ...
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/customers/FilterableTableHeader.tsx` | Header cell with sort + filter dropdown |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/customers/OrganisationsTab.tsx` | Replace external filters with header filters |
| `src/components/customers/CustomersTab.tsx` | Replace external filters with header filters |
| `src/components/customers/CRMDataFilters.tsx` | Simplify to just search + column selector |

## Files to Keep (unchanged)

- `src/components/customers/MultiSelectFilter.tsx` - Reuse internally
- `src/components/customers/ColumnSelector.tsx` - Still needed
- `src/hooks/useColumnPreferences.ts` - Still needed

---

## FilterableTableHeader Design

### Visual States

**Default (no filter active):**
```text
+------------------+
| Country     [v]  |
+------------------+
```

**Filter active (highlighted):**
```text
+------------------+
| Country (2) [v]  |  <- Shows count of selected
+------------------+
```

### Dropdown Contents

```text
+----------------------+
| Sort A-Z             |
| Sort Z-A             |
|----------------------|
| [ ] Select all       |
|----------------------|
| [x] Ireland          |
| [x] UK               |
| [ ] USA              |
| [ ] Germany          |
|----------------------|
| Clear filter         |
+----------------------+
```

---

## Which Columns Get Filters

### Organisations Tab
| Column | Sortable | Filterable | Filter Type |
|--------|----------|------------|-------------|
| Name | Yes | No | - |
| Labels | No | Yes | Multi-select |
| Address | No | No | - |
| Website | No | No | - |
| LinkedIn | No | No | - |
| Industry | Yes | Yes | Multi-select |
| Revenue | Yes | Yes | Range select |
| Funding | Yes | No | - |
| Employees | No | Yes | Multi-select |
| Contacts | Yes | No | - |
| Next Activity | Yes | No | - |
| Done Activities | Yes | No | - |
| Emails | Yes | No | - |
| Description | No | No | - |
| Founded | Yes | No | - |
| Domains | No | No | - |
| Categories | No | Yes | Multi-select |
| Connection | Yes | Yes | Multi-select |
| Country | Yes | Yes | Multi-select |
| Last Interaction | Yes | No | - |

### Customers Tab
| Column | Sortable | Filterable | Filter Type |
|--------|----------|------------|-------------|
| Name | Yes | No | - |
| Connection | Yes | Yes | Multi-select |
| Email | No | No | - |
| Company | No | Yes | Multi-select |
| Description | No | No | - |
| Job Title | Yes | Yes | Multi-select |
| Function | No | Yes | Multi-select |
| Labels | No | Yes | Multi-select |
| Emails | Yes | No | - |
| Phone | No | No | - |
| Location | No | Yes | Multi-select |
| Facebook | No | No | - |
| Instagram | No | No | - |
| LinkedIn | No | No | - |
| Marketing Status | No | Yes | Multi-select |
| Last Activity | Yes | No | - |
| Seniority | No | Yes | Multi-select |
| Interest | No | Yes | Multi-select |
| LQS | Yes | No | - |

---

## Implementation Steps

1. **Create FilterableTableHeader** - Build the new header component with popover, sort buttons, and multi-select filter
2. **Update OrganisationsTab** - Remove CRMDataFilters usage, update column headers to use FilterableTableHeader
3. **Update CustomersTab** - Same changes as OrganisationsTab
4. **Simplify CRMDataFilters** - Remove filter dropdowns, keep only search and children slot
5. **Test** - Verify filtering and sorting work correctly from headers

---

## User Experience

### Filtering Workflow
1. Click column header dropdown arrow
2. See sort options at top
3. See available filter values as checkboxes
4. Check/uncheck values to filter
5. Close popover - filter applies immediately
6. Header shows badge with count of active filters

### Clear Filters
- Click "Clear filter" within any column dropdown
- Or use "Clear all" button in search bar area to reset all filters

---

## Summary

- Remove external filter bar with dropdown buttons
- Move filtering into each column header
- Keep search input and column selector in simplified toolbar
- Each filterable column header has a popover with sort + filter options
- Visual indicator shows when a column has active filters

