

# Enhanced LMS Leads Table + Multi-Select Integration

## Overview
Add additional columns from the external LMS endpoint to the LMS Leads table (status, signup type, company size, use case, learning objectives, marketing status, created date, credits, plan) and enable multi-select functionality for LMS customers in both the Sequences enrollment modal and Abandonment campaigns.

---

## Files to Modify

### 1. Update Interface: `src/hooks/useExternalLMSCustomers.ts`

**Changes**:
- Add `status` field to `ExternalLMSCustomer` interface
- The interface already includes most fields, verify `status` is captured

```typescript
export interface ExternalLMSCustomer {
  id: string;
  email: string;
  full_name: string;
  role?: string;
  company_size?: string;
  use_case?: string;
  learning_objectives?: string;
  marketing_consent?: boolean;
  verified?: boolean;
  created_at?: string;
  credits_used?: number;
  credits_total?: number;
  plan?: string;
  signup_type?: string;
  status?: string; // NEW - e.g. "active", "trial", "expired"
}
```

---

### 2. Update Edge Function: `supabase/functions/fetch-lms-customers/index.ts`

**Changes**:
- Add `status` to the interface
- Ensure all fields are passed through from external API

---

### 3. Enhanced Table: `src/components/customers/ExternalLMSLeadsTab.tsx`

**Current columns**: Name, Email, Plan, Role, Credits, Status (verified), Registered

**New columns to add**:
- **Signup Type** - Badge showing how they signed up
- **Company Size** - Text field
- **Use Case** - Text field (potentially truncated with tooltip)
- **Learning Objectives** - Text field (potentially in expandable row)
- **Marketing Status** - Badge (Opted In / Not Opted)
- **LMS Status** - Badge from the status field (active/trial/etc)
- **Credits Available** - Progress bar (credits_total - credits_used)

**Additional features**:
- Row selection with checkboxes for multi-select
- Bulk action bar when rows selected
- "Enroll in Sequence" button to open EnrollContactModal with LMS customers

---

### 4. Update Sequences Enrollment: `src/components/sequences/EnrollContactModal.tsx`

**Changes**:
- Add tabs: "CRM Contacts" | "LMS Customers"
- LMS tab shows external LMS customers with multi-select
- When enrolling LMS customers:
  - Check if CRM contact exists (by email match)
  - Create contact if missing with label "LMS Lead"
  - Enroll in selected sequence
- Use the same enrollment logic as `EnrollAbandonmentModal`

---

### 5. Update Recovery Tab: `src/components/recovery/SignupAbandonmentTab.tsx`

**Changes**:
- Add additional columns to match the enhanced ExternalLMSLeadsTab:
  - Company Size
  - Use Case
  - Learning Objectives
  - LMS Status
  - Credits Available
- Keep existing functionality (unverified filter, bulk enrollment)

---

## Implementation Details

### Table Column Structure for LMS Leads

| Column | Data Source | Display Type |
|--------|-------------|--------------|
| Select | - | Checkbox |
| Name | full_name, email | Text + Subtext |
| Status | status | Badge (color-coded) |
| Signup Type | signup_type | Badge |
| Company Size | company_size | Text |
| Use Case | use_case | Truncated text with tooltip |
| Learning Objectives | learning_objectives | Expandable/tooltip |
| Marketing | marketing_consent | Badge (Yes/No) |
| Created | created_at | Formatted date |
| Credits | credits_used, credits_total | Progress bar |
| Plan | plan | Badge |
| Actions | - | Enroll button |

### Enrollment Modal Tabs

```text
+-------------------+--------------------+
| CRM Contacts (42) | LMS Customers (128)|
+-------------------+--------------------+
|                                        |
| [Search bar]                           |
|                                        |
| [ ] Contact/Customer Row               |
| [ ] Contact/Customer Row               |
| [ ] Contact/Customer Row               |
|                                        |
+----------------------------------------+
```

### Multi-Select Flow

1. User selects multiple LMS customers via checkboxes
2. Clicks "Enroll in Sequence" button
3. Modal opens with sequence selector
4. On confirmation:
   - For each LMS customer:
     - Check if email exists in CRM contacts
     - Create contact if not found (with "LMS Lead" label)
     - Create sequence enrollment
   - Display progress and results

---

## Technical Details

### Data Flow

```text
External LMS API (crm-customers)
        |
        v
fetch-lms-customers Edge Function
        |
        v
useExternalLMSCustomers Hook
        |
        +---> ExternalLMSLeadsTab (full table)
        |
        +---> EnrollContactModal (LMS tab)
        |
        +---> SignupAbandonmentTab (filtered for unverified)
```

### Existing Enrollment Logic Reuse

The `EnrollAbandonmentModal` already handles:
- Contact creation with labels
- Sequence enrollment
- Progress tracking
- Activity logging

This logic will be extracted/reused in the enhanced `EnrollContactModal`.

---

## Security Considerations

- All LMS data accessed through authenticated proxy (fetch-lms-customers)
- Contact creation respects RLS (user_id assignment)
- Sequence enrollments tied to authenticated user

