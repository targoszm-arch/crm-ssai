

# Fix Search Bars to Trigger on Enter Key Only

## Summary
Currently, all search bars across the platform filter automatically as you type (with debounce). This change will make search only trigger when the user presses **Enter**, giving more control and reducing unnecessary filtering/API calls.

## What Changes

Every search input will:
- Still update the text field as you type (so you can see what you're typing)
- Only trigger the actual search/filter when you press **Enter**
- Still allow clearing via the X button (which also triggers search reset)

## Files to Modify

### Shared Filter Components (affects Customers + Organisations tabs)

1. **`src/components/customers/CRMDataFilters.tsx`**
   - Remove `useDebounce` import and logic
   - Add `onKeyDown` handler that calls `onSearchChange` on Enter
   - Keep local state for typing, only commit on Enter or clear

2. **`src/components/customers/DataFilters.tsx`**
   - Same changes as CRMDataFilters

### Page-Level Inline Search Inputs

3. **`src/pages/Deals.tsx`** - Deals search
4. **`src/pages/Campaigns.tsx`** - Campaigns search
5. **`src/pages/Finances.tsx`** - Transactions search
6. **`src/pages/Orders.tsx`** - Orders search
7. **`src/pages/CartAbandonment.tsx`** - Carts search

For pages 3-7: Add a local input state separate from the filter state, commit on Enter only.

### Component-Level Search Inputs

8. **`src/components/customers/ExternalLMSLeadsTab.tsx`** - LMS leads search
9. **`src/components/inbox/EmailList.tsx`** - Email search
10. **`src/components/recovery/SignupAbandonmentTab.tsx`** - Signup abandonment search
11. **`src/components/templates/TemplateListModal.tsx`** - Template search
12. **`src/components/sequences/EnrollContactModal.tsx`** - Contact enrollment search

### Not Changed (intentionally)
- **`src/components/shared/LabelSelector.tsx`** - This is a small dropdown filter, instant search makes sense here
- **`src/components/customers/FilterableTableHeader.tsx`** - Uses `CommandInput`, instant filter is appropriate for column filters

## Technical Approach

For the shared components (`CRMDataFilters`, `DataFilters`):
- Remove `useDebounce` dependency
- Keep `localSearch` state for the input value
- Add `handleKeyDown` that checks `e.key === "Enter"` and calls `onSearchChange(localSearch)`
- Clear button still calls `onSearchChange("")` immediately

For inline search inputs on pages/components:
- Split into `localSearch` (controls the input) and the actual filter state
- Add `onKeyDown` handler to the Input
- On Enter: set the filter state from local state
- On clear (X button): reset both states

