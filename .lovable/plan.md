

# Plan: Enhanced CRM with Extended Columns, Multi-Select Filters, and Column Customization

## Overview

This plan adds all requested columns from your CSV files to both Organisations and Customers views, replaces single-select filters with multi-select comboboxes, and adds the ability to select and reorder visible columns.

---

## What We'll Build

### 1. Database Schema Updates

**Companies Table - Add New Columns:**
| Column | Type | Purpose |
|--------|------|---------|
| `people_count` | INTEGER | Count of associated contacts |
| `next_activity_date` | TIMESTAMPTZ | Next scheduled activity |
| `done_activities` | INTEGER | Number of completed activities |
| `email_messages_count` | INTEGER | Count of email messages |
| `labels` | TEXT | Organization labels (Cold lead, Hot lead, etc.) |
| `address` | TEXT | Full address |

**Contacts Table - Add New Columns:**
| Column | Type | Purpose |
|--------|------|---------|
| `connection_strength` | TEXT | Person's connection strength |
| `facebook_url` | TEXT | Facebook profile URL |
| `instagram_url` | TEXT | Instagram profile URL |
| `marketing_status` | TEXT | Marketing status (Subscribed, Archived, etc.) |
| `last_email_received` | TIMESTAMPTZ | When last email was received |
| `seniority_level` | TEXT | CXO, Director, Manager, etc. |
| `function` | TEXT | Job function (Legal, Sales, etc.) |
| `next_recommended_action` | TEXT | AI-recommended next action |
| `buying_signals` | TEXT | Detected buying signals |
| `pain_point` | TEXT | Detected pain points |
| `interest_level` | TEXT | Low, Medium, High |
| `lqs` | INTEGER | Lead Qualification Score |
| `email_messages_count` | INTEGER | Count of emails |
| `labels` | TEXT | Person labels |
| `done_activities` | INTEGER | Completed activities count |

### 2. Multi-Select Filter Component

Replace current single-select dropdowns with a multi-select combobox component:

- Uses Popover + Command pattern for searchable multi-select
- Checkbox items for multiple selections
- "Clear all" and "Select all" options
- Badge display of selected count

**Filters to create:**
- Country (multi-select)
- Employees (multi-select)  
- Revenue (multi-select)
- Labels (multi-select)
- Job Titles (multi-select)
- Industry (multi-select)
- Updated Time (date range)
- Email messages sent (range)

### 3. Column Visibility & Reordering

**Column Settings Panel:**
- Dropdown/popover to toggle column visibility
- Drag-and-drop column reordering
- Persist preferences to localStorage
- "Reset to default" option

**Organisations Columns (all selectable):**
| Column | Default Visible |
|--------|-----------------|
| Name | Yes |
| Labels | No |
| Address | No |
| Website | No |
| LinkedIn | Yes |
| Industry | No |
| Revenue | No |
| Funding Raised | No |
| Employees | Yes |
| Contacts Count | Yes |
| Next Activity Date | No |
| Done Activities | No |
| Email Messages Count | No |
| Description | No |
| Date Founded | No |
| Domains | No |
| Categories | No |
| Connection Strength | Yes |
| Country | Yes |
| Last Interaction | Yes |

**Customers Columns (all selectable):**
| Column | Default Visible |
|--------|-----------------|
| First Name | Yes |
| Last Name | Yes |
| Connection Strength | No |
| Email | Yes |
| Company | Yes |
| Description | No |
| Job Title | Yes |
| Function | No |
| Labels | No |
| Email Messages Count | No |
| Phone | Yes |
| Location | No |
| Facebook | No |
| Instagram | No |
| LinkedIn | No |
| Marketing Status | No |
| Last Activity Date | Yes |
| Last Email Received | No |
| Personalisation Notes | No |
| Seniority Level | No |
| Next Recommended Action | No |
| Buying Signals | No |
| Pain Point | No |
| Interest Level | No |
| LQS | No |

### 4. Updated Edge Functions for Import

Modify the import functions to handle all the new columns from your CSVs:

**Organizations CSV Mapping:**
```text
Organization - Labels -> labels
Organization - Address -> address
Organization - People -> people_count
Organization - Next activity date -> next_activity_date
Organization - Done activities -> done_activities
Organization - Email messages count -> email_messages_count
Organization - Year Founded -> foundation_date
Organization - Description -> description
```

**People CSV Mapping:**
```text
Person - Labels -> labels
Person - Function -> function
Person - Marketing status -> marketing_status
Person - Last email received -> last_email_received
Person - Seniority level -> seniority_level
Person - Next recommended action -> next_recommended_action
Person - Buying signals -> buying_signals
Person - Pain Point detected -> pain_point
Person - Interest level -> interest_level
Person - LQS -> lqs
Person - Email messages count -> email_messages_count
Person - Done activities -> done_activities
```

---

## Technical Details

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/customers/MultiSelectFilter.tsx` | Reusable multi-select combobox filter |
| `src/components/customers/ColumnSelector.tsx` | Column visibility and reorder panel |
| `src/hooks/useColumnPreferences.ts` | Persist column settings to localStorage |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/customers/DataFilters.tsx` | Replace Select with MultiSelectFilter |
| `src/components/customers/OrganisationsTab.tsx` | Add all columns, integrate column selector |
| `src/components/customers/CustomersTab.tsx` | Add all columns, integrate column selector |
| `src/hooks/useCompanies.ts` | Add new filter types for multi-select |
| `src/hooks/useContacts.ts` | Add new filter types for multi-select |
| `supabase/functions/import-companies/index.ts` | Map all new CSV columns |
| `supabase/functions/import-contacts/index.ts` | Map all new CSV columns |

### Database Migration SQL

```sql
-- Add new columns to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS people_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS next_activity_date TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS done_activities INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email_messages_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS labels TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;

-- Add new columns to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS connection_strength TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS marketing_status TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_email_received TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS seniority_level TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS function TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_recommended_action TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS buying_signals TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pain_point TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS interest_level TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lqs INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_messages_count INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS labels TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS done_activities INTEGER DEFAULT 0;
```

### Multi-Select Filter Component Structure

```typescript
interface MultiSelectFilterProps {
  label: string;
  options: { label: string; value: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}
```

### Column Preference Hook

```typescript
interface ColumnPreference {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

function useColumnPreferences(tableKey: string) {
  // Load/save from localStorage
  // Returns: columns, toggleColumn, reorderColumn, resetToDefault
}
```

---

## UI Preview

### Filters with Multi-Select

```text
+----------------------------------------------------------------+
| Search: [_______________]                                       |
|                                                                |
| Filters:                                                       |
| [Country v] [Industry v] [Employees v] [Revenue v] [Labels v]  |
|                                                                |
| Active: Ireland, UK (+2 more)  |  Clear all filters            |
+----------------------------------------------------------------+
```

### Column Selector

```text
+---------------------------+
| Columns                   |
| [x] Name                  |
| [x] LinkedIn              |  
| [ ] Address              |
| [ ] Website              |
| [x] Industry             |
| ... (drag to reorder)    |
| [Reset to default]       |
+---------------------------+
```

---

## Implementation Steps

1. **Database**: Run migration to add new columns to both tables
2. **Multi-Select Component**: Create reusable MultiSelectFilter 
3. **Column Preferences**: Create hook for persisting column settings
4. **Column Selector**: Build UI for toggling/reordering columns
5. **Update Filters**: Replace DataFilters with multi-select version
6. **Update Tab Components**: Integrate column selector and all columns
7. **Update Edge Functions**: Map all new CSV columns for import
8. **Update Hooks**: Add multi-value filter support to queries
9. **Import Data**: Re-import CSVs to populate new columns

---

## Categories Multi-Select Options

For the Categories field (as specified):
- B2B
- B2C
- Consulting
- Financial Services
- IT
- SaaS
- Technology
- Healthcare
- E-commerce
- Transit
- Government
- Insurance
- Finance
- Legal
- Real Estate
- International Relations
- Education
- Marketplace
- BCG
- Airlines
- Asset Management
- Construction
- Energy
- Enterprise
- NGO
- Health & Wellness
- University
- Manufacturing
- Industrial Services
- International Trade
- Investment Banking
- Market Research
- Media
- Pharmaceuticals
- Payments
- Utilities
- Venture Capital
- Consumer Services
- Security

