
# Fix Multi-Select in LMS Leads + Add Bulk Actions to Customers Tab

## Problem: LMS Leads Select-All Bug

The external LMS API likely returns records without a unique `id` field (or with `undefined` IDs). When `customer.id` is `undefined` for all rows, clicking ANY row's checkbox adds `undefined` to the selection Set, and then `selectedIds.has(customer.id)` returns `true` for EVERY row -- making it look like all rows get selected at once.

**Fix**: Use `customer.email` as the unique identifier instead of `customer.id`, since email is always present and unique. Also add `e.stopPropagation()` on row checkboxes (matching the Organisations pattern).

## Changes

### 1. Fix LMS Leads multi-select (`src/components/customers/ExternalLMSLeadsTab.tsx`)
- Change all selection logic to use `customer.email` instead of `customer.id` as the unique key
- Update `handleSelectAll` to map by `email`
- Update `handleSelectOne` to use `email`
- Update `selectedUsers` filter to match by `email`
- Update the header checkbox `checked` comparison
- Add `onClick={e.stopPropagation()}` to row checkboxes
- Update `onEnroll` to use `email` in the Set

### 2. Add bulk select + actions to Customers tab (`src/components/customers/CustomersTab.tsx`)
- Add `selectedIds` state (Set of contact IDs)
- Add `handleSelectAll` and `handleSelectOne` handlers
- Add a checkbox "select" column as the first column (same pattern as Organisations)
- Add a `useDeleteContacts` hook to `src/hooks/useContacts.ts`
- Add a bulk action bar above the table with: Clear Selection, Export CSV, Delete Selected
- Create a reusable `CustomersBulkActionBar.tsx` component (mirrors `OrganisationsBulkActionBar`)

### 3. Add `useDeleteContacts` hook (`src/hooks/useContacts.ts`)
- New mutation that deletes contacts by an array of IDs
- Invalidates contact queries on success

### 4. New file: `src/components/customers/CustomersBulkActionBar.tsx`
- Same structure as `OrganisationsBulkActionBar` but labeled for "contacts"
- Actions: Clear, Export CSV, Delete (with confirmation dialog)

### Files Modified
- `src/components/customers/ExternalLMSLeadsTab.tsx` -- fix email-based selection
- `src/components/customers/CustomersTab.tsx` -- add checkbox column, selection state, bulk bar
- `src/hooks/useContacts.ts` -- add `useDeleteContacts` mutation

### New Files
- `src/components/customers/CustomersBulkActionBar.tsx` -- bulk action bar for contacts
