

# Plan: Display Colored Labels in Tables & Clickable Organisation Names

## Overview

Add colored label display in the Customers and Organisations table columns (using the same color system from EditableLabels), and make Organisation names clickable to open the detail drawer.

---

## Fireflies Webhook URL

For your Fireflies integration, configure the webhook URL to:

```
https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/fireflies-webhook
```

In Fireflies, enable **"Transcription Completed"** event type to trigger when meetings finish processing.

---

## Implementation

### 1. Extract Shared Label Utilities

Create a shared utility file for label parsing and colors:

| File | Purpose |
|------|---------|
| `src/lib/labelColors.ts` | Export `LABEL_COLORS`, `parseLabel()`, and `LabelWithColor` type |

This avoids code duplication between EditableLabels and table components.

### 2. Update CustomersTab Labels Column

**File:** `src/components/customers/CustomersTab.tsx`

Current (line 260):
```tsx
cell: (contact) => contact.labels ? <Badge variant="outline">{contact.labels}</Badge> : "-"
```

New:
```tsx
cell: (contact) => {
  if (!contact.labels) return "-";
  const labels = contact.labels.split(",").map(l => parseLabel(l.trim())).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((label, i) => (
        <span key={i} className={cn("px-2 py-0.5 rounded-md text-xs font-medium border", color.bg, color.text, color.border)}>
          {label.text}
        </span>
      ))}
    </div>
  );
}
```

### 3. Update OrganisationsTab Labels Column

**File:** `src/components/customers/OrganisationsTab.tsx`

Apply the same color rendering as CustomersTab.

### 4. Make Organisation Name Clickable

**File:** `src/components/customers/OrganisationsTab.tsx`

Current (lines 149-158):
```tsx
cell: (company: Company) => (
  <div className="flex items-center gap-2">
    <div className="w-8 h-8 rounded-full ...">
      {company.company_name?.substring(0, 2).toUpperCase()}
    </div>
    <div>
      <div className="font-medium">{company.company_name}</div>
    </div>
  </div>
)
```

New:
```tsx
cell: (company: Company) => (
  <div className="flex items-center gap-2">
    <div className="w-8 h-8 rounded-full ...">
      {company.company_name?.substring(0, 2).toUpperCase()}
    </div>
    <button
      type="button"
      onClick={() => handleViewCompany(company)}
      className="font-medium text-left hover:text-primary hover:underline transition-colors"
    >
      {company.company_name}
    </button>
  </div>
)
```

This matches the pattern used in CustomersTab for contact names.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/labelColors.ts` | **New** - shared label color utilities |
| `src/components/customers/EditableLabels.tsx` | Import from shared utility |
| `src/components/customers/CustomersTab.tsx` | Colored labels in table cell |
| `src/components/customers/OrganisationsTab.tsx` | Colored labels + clickable name |

---

## Summary

| Feature | Implementation |
|---------|---------------|
| Colored labels in tables | Parse `label:colorIndex` format and apply Tailwind color classes |
| Clickable organisation name | Wrap name in button with onClick to open drawer |
| Code reuse | Extract shared utilities to `src/lib/labelColors.ts` |

