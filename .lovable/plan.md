

# Plan: Fix Import Mapping and Header Filter Issues

## Issues Identified

### Issue 1: Industry Data Not Being Imported Correctly
**Root Cause**: The CSV file has TWO columns with similar names:
- Column 6: `Organization - Industry` - Contains data like "Government administration", "Utilities"
- Column 28: `Organization - Industry` - Duplicate column, appears empty

The import function correctly references `record["Organization - Industry"]`, but only 1 of 1,099 records has industry populated in the database. This suggests a parsing issue with the duplicate column names overwriting each other.

### Issue 2: Employees Column Not Searchable/Filterable
**Root Cause**: The CSV has:
- `Organization - Number of employees` (lowercase 'e') - Contains values like "0", "3500"

But the import function looks for:
- `record["Organization - Number of Employees"]` (uppercase 'E')

This case sensitivity mismatch means `employee_range` is always NULL.

### Issue 3: Filter Options Empty
Since the data wasn't imported correctly, the filter options for Industry and Employees show no values to select from.

---

## Solution

### Step 1: Fix Import Function Column Mappings

Update the import function to:
1. Handle duplicate CSV column names by taking the first non-empty value
2. Fix case sensitivity for employee column
3. Create meaningful employee_range values from raw employee count

**Current mapping (broken):**
```javascript
industry: record["Organization - Industry"], // Gets overwritten by duplicate column
employee_range: record["Organization - Number of Employees"], // Wrong case
```

**Fixed mapping:**
```javascript
// Use the first Industry column's value (before it gets overwritten)
industry: record["Organization - Industry (column 6)"], 
// Fix case to match CSV header exactly  
employee_range: createEmployeeRange(record["Organization - Number of employees"]),
```

### Step 2: Parse Duplicate Headers Correctly

Modify the CSV parsing to handle duplicate column names by appending an index or keeping track of the first occurrence.

### Step 3: Create Employee Range from Count

Since the CSV has raw employee counts, create readable ranges:
- 0-10: "1-10"
- 11-50: "11-50"  
- 51-200: "51-200"
- 201-500: "201-500"
- 501-1000: "501-1000"
- 1001+: "1000+"

### Step 4: Re-import Data

After fixing the import function, re-import the CSV to populate Industry and Employee Range correctly.

---

## Technical Details

### Updated Import Function

```typescript
// Handle duplicate columns by tracking occurrences
const headerOccurrences: Record<string, number> = {};
const uniqueHeaders = headers.map((header) => {
  if (headerOccurrences[header] !== undefined) {
    headerOccurrences[header]++;
    return `${header}_${headerOccurrences[header]}`;
  }
  headerOccurrences[header] = 0;
  return header;
});

// Map with correct column names (case-sensitive)
const company = {
  industry: record["Organization - Industry"] || null,
  employee_range: createEmployeeRange(
    parseInt(record["Organization - Number of employees"]) || 0
  ),
  // ... rest of mappings
};

function createEmployeeRange(count: number): string | null {
  if (!count || count === 0) return null;
  if (count <= 10) return "1-10";
  if (count <= 50) return "11-50";
  if (count <= 200) return "51-200";
  if (count <= 500) return "201-500";
  if (count <= 1000) return "501-1000";
  return "1000+";
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/import-companies/index.ts` | Fix column name case sensitivity, add employee range calculation |

---

## Implementation Steps

1. Update import function to fix case-sensitive column name matching
2. Add logic to handle duplicate header columns
3. Add `createEmployeeRange()` function to convert raw counts to ranges
4. Deploy updated edge function
5. Re-import organisations CSV with `clearExisting: true`
6. Verify Industry and Employees filters now show options

---

## After Fix

The table headers will correctly show:
- **Industry filter**: Government administration, Utilities, Financial services, etc.
- **Employees filter**: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+

And clicking on these column headers will display the searchable multi-select filter with actual values from your data.

