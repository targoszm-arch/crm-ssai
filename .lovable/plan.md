

# Plan: Fix Bugs and Replace Data with New CSV Files

## Issues Identified

### Bug 1: "View" Button on Organisations Tab Not Showing Contacts
**Root Cause:** The `useContactsByCompany` hook in `OrganisationDetail.tsx` is working correctly, but I need to verify the query is properly linking to the company. The foreign key relationship exists (`fk_contacts_company`) but the current sample contacts may not be linked to the correct company IDs.

### Bug 2: Search Filter Triggers on Every Keystroke
**Root Cause:** The search input in `DataFilters.tsx` directly updates the filter state on every `onChange` event without debouncing. This causes a new API query with each keystroke.

### Data Replacement Requirement
You want to replace the existing data with the two new CSV files:
- `organizations-27348383-8.csv` (~1,100 organisations)
- `people-27348383-7.csv` (~1,597 people/customers)

---

## CSV Column Mapping

### Organisations CSV (organizations-27348383-8.csv)

| CSV Column | Database Column | Notes |
|------------|-----------------|-------|
| Organization - Name | company_name | Required |
| Organization - Labels | stage | Map labels to stage |
| Organization - Country of Address | country | |
| Organization - Website | website | New column needed |
| Organization - LinkedIn profile | linkedin_url | |
| Organization - Industry | industry | |
| Organization - Annual revenue | annual_turnover | Parse to numeric |
| Organization - Number of employees | employee_count | Parse to integer |
| Organization - ID | client_id | External ID reference |
| Organization - Last activity date | last_interaction | |
| Organization - Address | description | Use as location/description |
| Organization - Description | description | Company description |
| Organization - Year Founded | foundation_date | |
| Organization - Total Funding | funding_raised | Parse to numeric |
| Organization - Number of Employees | employee_range | Text range |

### People CSV (people-27348383-7.csv)

| CSV Column | Database Column | Notes |
|------------|-----------------|-------|
| Person - First name | first_name | Required |
| Person - Last name | last_name | |
| Person - Organization | company_id | Match to company by name |
| Person - Job title | title | |
| Person - Email - Work | email | Primary email |
| Person - Phone - Mobile | phone | Primary phone |
| Person - Phone - Work | phone | Fallback phone |
| Person - Country of Postal address | work_location | |
| Person - LinkedIn URL (Lead CRM) | linkedin_url | |
| Person - linkedin_handle | linkedin_url | Fallback LinkedIn |
| Person - Last activity date | last_contacted | |
| Person - Personalization_Notes | notes | |
| Person - Seniority level | title | Append to title |

---

## Implementation Steps

### Step 1: Add Search Debouncing
Create a debounced search hook and update `DataFilters.tsx` to wait 300ms after user stops typing before triggering the search.

Files to modify:
- `src/components/customers/DataFilters.tsx` - Add internal debounce state
- Create `src/hooks/useDebounce.ts` - Reusable debounce hook

### Step 2: Update Edge Function for New CSV Format
Modify the import function to handle the new column names from your CSV files and create a new function for importing contacts.

Files to modify:
- `supabase/functions/import-companies/index.ts` - Update column mapping
- Create `supabase/functions/import-contacts/index.ts` - New function for people import

### Step 3: Clear Existing Data and Import New Data
1. Delete existing companies and contacts (to replace with new data)
2. Import organisations from new CSV
3. Import people from new CSV, matching to companies by organisation name

### Step 4: Fix Organisation Detail View
Ensure the `useContactsByCompany` hook properly queries contacts and update the UI to handle loading states correctly.

Files to verify:
- `src/hooks/useContacts.ts` - Verify query syntax
- `src/components/customers/OrganisationDetail.tsx` - Ensure company ID is passed correctly

---

## Technical Details

### New Debounce Hook
```typescript
// src/hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}
```

### Updated DataFilters with Debouncing
The search input will update a local state immediately (for responsive UI), but only trigger the filter callback after 300ms of no typing.

### Edge Function for Contact Import
The new function will:
1. Parse the people CSV
2. Look up each organisation name to find the matching company_id
3. Insert contacts with proper company linkage
4. Handle multiple email/phone fields by picking the primary one

### Database Operations
```sql
-- Clear existing data (in order due to foreign key)
DELETE FROM contacts;
DELETE FROM companies;
```

Then import fresh data from both CSVs.

---

## File Changes Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useDebounce.ts` | Create | Reusable debounce hook |
| `src/components/customers/DataFilters.tsx` | Modify | Add search debouncing |
| `supabase/functions/import-companies/index.ts` | Modify | Update for new CSV format |
| `supabase/functions/import-contacts/index.ts` | Create | Import people from CSV |
| `src/components/customers/ImportDataButton.tsx` | Modify | Add contacts import option |

---

## Summary

1. **Fix debouncing** - Search will wait 300ms after you stop typing
2. **Update import functions** - Handle your new CSV column formats
3. **Replace all data** - Clear existing and import ~1,100 orgs + ~1,600 contacts
4. **Verify linking** - Contacts will be linked to organisations by name matching
5. **Test View button** - With properly linked data, the detail view will show contacts

