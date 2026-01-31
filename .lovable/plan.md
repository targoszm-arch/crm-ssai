

# Plan: Fix Meet Alfred Campaign Sync and Add Bulk Actions

## Summary

This plan addresses three issues:
1. **Campaign Sync Bug**: Campaigns showing as "Campaign 1222351" instead of real names like "Punk rock HR newsletter", with 0 leads/stats
2. **LMS Leads Bulk Selection Bug**: Selecting one lead selects all leads
3. **Missing Bulk Actions**: Companies/Organisations tables lack bulk action functionality

---

## Issue 1: Meet Alfred Campaign Sync Not Pulling Correct Data

### Root Cause Analysis

Looking at the database query results and edge function code, the issue is clear:

**Database shows:**
```
name: "Campaign 1222351"
total_leads: 0
sent_count: 0
```

**But Meet Alfred has:**
```
name: "Punk rock HR newsletter"  
total_leads: 57
```

The sync function at line 123-128 tries multiple field names but falls back to `Campaign ${campaign.id}`:
```typescript
const campaignName = 
  campaign.name || 
  campaign.sequence_name || 
  campaign.title || 
  campaign.campaign_name ||
  `Campaign ${campaign.id}`;  // <-- This fallback is being hit!
```

### Likely Cause

The Meet Alfred "Get Campaigns" API returns data in a different structure than expected. Based on the pattern, the API likely returns campaigns with the ID as the key or uses a nested structure.

### Solution

1. **Add detailed logging** to capture the exact API response structure
2. **Update field extraction** to check additional nested paths like:
   - `campaign.sequence?.name`
   - `campaign.campaign?.name`
   - `campaign.details?.name`
   - Check if it's a keyed object `{ [id]: { name, status, ... } }`
3. **Fix status mapping** - the API may return booleans (is_active/is_paused) or different status strings

### File: `supabase/functions/meetalfred-sync/index.ts`

```text
Changes to campaign sync section (~lines 96-187):

1. Log the raw API response structure more clearly
2. Check if campaigns are returned as an object keyed by ID
3. Add extraction for nested structures like campaign.sequence or campaign.details
4. Improve status detection with more field variations
5. Add extraction for leads/stats from alternative field names
```

---

## Issue 2: LMS Leads Bulk Selection Bug

### Root Cause

In `ExternalLMSLeadsTab.tsx`, the checkbox `onCheckedChange` handler at line 296-298 is receiving the wrong type:

```tsx
<Checkbox
  checked={selected}
  onCheckedChange={onSelect}  // onSelect expects (checked: boolean)
/>
```

The issue is that `onCheckedChange` from Radix Checkbox can return `boolean | "indeterminate"`, and the row's `onSelect` prop is: 
```typescript
onSelect: (checked: boolean) => void
```

But the actual problem is in how the handlers are wired:

```tsx
// Line 237-239
onSelect={(checked) => handleSelectOne(customer.id, checked)}
```

The `checked` parameter is typed correctly but the Checkbox component may be passing events or incorrect values.

### Solution

**File: `src/components/customers/ExternalLMSLeadsTab.tsx`**

Fix the checkbox handler to ensure proper boolean coercion:

```tsx
// Line 296-299 in LMSCustomerRow
<Checkbox
  checked={selected}
  onCheckedChange={(checked) => onSelect(checked === true)}
/>
```

And ensure the header checkbox has the same fix:
```tsx
// Line 213-215
<Checkbox
  checked={selectedIds.size === filteredCustomers.length && filteredCustomers.length > 0}
  onCheckedChange={(checked) => handleSelectAll(checked === true)}
/>
```

---

## Issue 3: Add Bulk Actions to Companies/Organisations

### Current State

- **CustomersTab** and **OrganisationsTab** use `DataTable` component
- `DataTable` component has no selection support built in
- **ExternalLMSLeadsTab** has its own Table implementation with checkboxes

### Solution

Add bulk selection and action functionality to OrganisationsTab similar to ExternalLMSLeadsTab:

### File: `src/components/customers/OrganisationsTab.tsx`

1. Add state for selected IDs: `useState<Set<string>>(new Set())`
2. Add a checkbox column at the start of the columns array
3. Add header checkbox for select all
4. Add bulk action bar component when selections exist
5. Implement bulk actions:
   - Delete selected
   - Export selected
   - Add labels to selected
   - Enroll in sequence (if applicable)

### Changes to DataTable (Optional Enhancement)

Alternatively, enhance `DataTable` to support selection natively:

**File: `src/components/ui/data-table.tsx`**

Add optional props:
```typescript
interface DataTableProps<T> {
  // ... existing props
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  getRowId?: (row: T) => string;
}
```

However, for speed, it's simpler to add inline selection to OrganisationsTab directly (matching the ExternalLMSLeadsTab pattern).

---

## Implementation Details

### File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `supabase/functions/meetalfred-sync/index.ts` | Modify | Improve campaign field extraction and add debugging |
| `src/components/customers/ExternalLMSLeadsTab.tsx` | Modify | Fix checkbox boolean coercion bug |
| `src/components/customers/OrganisationsTab.tsx` | Modify | Add bulk selection and action bar |

### Bulk Actions for Organisations

The bulk action bar will include:
- Selection count display
- "Clear Selection" button
- "Delete Selected" button (with confirmation)
- "Add Labels" dropdown
- "Export to CSV" option

### Example UI Flow for Organisations

```text
+------------------------------------------+
| [x] | Name           | Country | ...     |
+------------------------------------------+
| [x] | Acme Corp      | USA     | ...     |
| [x] | TechStart Inc  | UK      | ...     |
| [ ] | GlobalCo       | Germany | ...     |
+------------------------------------------+

+------------------------------------------+
| 2 selected | [Clear] [Add Labels] [Delete] |
+------------------------------------------+
```

---

## Testing Checklist

After implementation:
1. Trigger a Meet Alfred sync and verify campaigns show correct names and stats
2. Test LMS leads checkbox - selecting one should only select that one
3. Test select all in LMS leads
4. Test organisations bulk selection
5. Test organisations bulk delete with confirmation
6. Verify bulk action bar appears/disappears correctly

