

# Plan: Fix Organisation-Contact Linking Persistence

## The Problem

When you import organisations (Step 1), all companies get **new UUIDs**. If contacts were imported previously, their `company_id` references now point to old company IDs that no longer exist in the companies table.

**Evidence from database:**
- "Intercity Transit" exists 3 times with different IDs
- Only 1 of those 3 has contacts linked (the one from the import that matched at the time)
- When you click View on a different "Intercity Transit" row, it shows empty because contacts are linked to a different ID

## Solution

Update the `import-companies` function to:
1. **Match existing companies by name** instead of always creating new records
2. **Update existing records** with new data while preserving their IDs
3. **Only create new records** for companies that don't already exist

This ensures that company IDs remain stable across imports, so contacts stay linked.

---

## Technical Implementation

### Updated Import Logic

```text
Current flow:
  1. DELETE all companies
  2. INSERT new companies (with new UUIDs)
  → Contacts become orphaned

New flow:
  1. For each company in CSV:
     a. Check if company_name already exists
     b. If exists → UPDATE the existing record (keep same ID)
     c. If not exists → INSERT new record
  2. Optionally: Delete companies not in the CSV (if clearExisting=true)
  → Contact links preserved
```

### Key Code Changes

```typescript
// For each company record from CSV:
const { data: existing } = await supabase
  .from("companies")
  .select("id")
  .ilike("company_name", companyName)
  .limit(1)
  .single();

if (existing) {
  // UPDATE existing - preserves the ID
  await supabase
    .from("companies")
    .update(companyData)
    .eq("id", existing.id);
} else {
  // INSERT new
  await supabase
    .from("companies")
    .insert(companyData);
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/import-companies/index.ts` | Switch from bulk delete+insert to upsert by name |

---

## Implementation Steps

1. **Modify import-companies function** - Use upsert logic instead of delete-then-insert
2. **Handle duplicates** - When upserting, match on company_name (case-insensitive)
3. **Remove orphan records** - If clearExisting is true, only delete companies NOT in the import file
4. **Deploy and test** - Re-import organisations, verify existing contact links are preserved

---

## Data Migration (One-Time Fix)

After fixing the import function, we also need to clean up the current duplicates and re-link contacts:

1. For each duplicate company name, identify which ID has contacts
2. Keep the record with contacts, delete the others
3. Or merge duplicates: update contacts to point to the canonical company ID, then delete duplicates

---

## Summary

| Before | After |
|--------|-------|
| Import organisations → all get NEW IDs | Import organisations → existing orgs keep their IDs |
| Contacts link to OLD company IDs → broken | Contacts still linked to same company IDs → works |
| Clicking View shows empty drawer | Clicking View shows linked contacts |

