
# Add Bulk Enrich to Customers and Organisations Tabs

## Overview
Add an "Enrich Selected" button to both the Customers and Organisations bulk action bars. When you select records via checkboxes and click "Enrich Selected", only the selected records get enriched via the existing Hunter.io + OpenAI edge functions. The enrichment runs sequentially to avoid rate limits.

## Changes

### 1. Add "Enrich Selected" to `OrganisationsBulkActionBar.tsx`
- Add a new `onEnrich` prop and `isEnriching` loading state prop
- Add a "Sparkles" icon button labeled "Enrich Selected" between Export and Delete
- Shows a loading spinner while enrichment is in progress

### 2. Add "Enrich Selected" to `CustomersBulkActionBar.tsx`
- Same pattern: add `onEnrich` and `isEnriching` props
- Add the "Enrich Selected" button with Sparkles icon

### 3. Wire bulk enrich in `OrganisationsTab.tsx`
- Import `enrichCompany` from `@/lib/api/enrichment`
- Add `isEnriching` state
- Add `handleBulkEnrich` function that loops through `selectedIds`, calls `enrichCompany(id)` for each selected company sequentially, shows a toast with progress, and invalidates the companies query when done
- Pass `onEnrich` and `isEnriching` to `OrganisationsBulkActionBar`

### 4. Wire bulk enrich in `CustomersTab.tsx`
- Import `enrichContact` from `@/lib/api/enrichment`
- Add `isEnriching` state
- Add `handleBulkEnrich` function that loops through `selectedIds`, calls `enrichContact(id)` for each selected contact sequentially, shows progress toasts, and invalidates the contacts query when done
- Pass `onEnrich` and `isEnriching` to `CustomersBulkActionBar`

### 5. Add batch enrichment API to `src/lib/api/enrichment.ts`
- Add `enrichCompanies(ids: string[])` helper that calls `enrichCompany` sequentially with error handling per record
- Add `enrichContacts(ids: string[])` helper that does the same for contacts
- Returns a summary: `{ succeeded: number, failed: number }`

## Files Modified
- `src/components/customers/OrganisationsBulkActionBar.tsx` -- add Enrich button
- `src/components/customers/CustomersBulkActionBar.tsx` -- add Enrich button
- `src/components/customers/OrganisationsTab.tsx` -- wire bulk enrich handler
- `src/components/customers/CustomersTab.tsx` -- wire bulk enrich handler
- `src/lib/api/enrichment.ts` -- add batch helpers

## No New Files
All changes go into existing files.

## Technical Details
- Enrichment calls are sequential (not parallel) to respect Hunter.io rate limits (15 requests/second on paid plans)
- Each call invokes the existing edge functions (`enrich-company` / `enrich-contact`) which already handle Hunter.io + OpenAI pipeline
- Progress is shown via toast notifications ("Enriching 3 of 10...")
- On completion, query cache is invalidated to refresh the table with enriched data
- Failed individual enrichments are counted but don't stop the batch
