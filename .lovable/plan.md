
# LMS Webhook Implementation

## Overview
Implementing the `lms-webhook` edge function to receive LMS registration data from SkillStudio and the corresponding frontend components to display LMS leads in the CRM.

---

## Files to Create/Modify

### 1. Edge Function: `supabase/functions/lms-webhook/index.ts`

**Purpose**: Webhook endpoint authenticated via `x-api-key` header

**Features**:
- Validates `CRM_WEBHOOK_API_KEY` secret
- Accepts POST requests with LMS user data
- Upserts leads to `lms_leads` table (by email + user_id)
- Auto-links to existing contacts by email match
- Auto-links to companies by email domain
- Creates new contact if none exists
- Returns success/error JSON response

**Expected Payload**:
```json
{
  "user_id": "lms_12345",
  "email": "instructor@skillstudio.ai",
  "name": "instructor Test",
  "role": "founder",
  "company_size": "2-20",
  "use_case": "lead generation",
  "learning_objectives": null,
  "marketing_consent": true,
  "verified": false,
  "created_at": "2026-01-24T00:00:00Z",
  "credits_used": 0,
  "credits_total": 200,
  "plan": "Instructor Trial",
  "crm_user_id": "uuid-of-crm-user"
}
```

---

### 2. Config: `supabase/config.toml`

Add new function configuration:
```toml
[functions.lms-webhook]
verify_jwt = false
```

---

### 3. React Hook: `src/hooks/useLMSLeads.ts`

**Exports**:
- `useLMSLeads()` - Fetch all LMS leads with related contacts/companies
- `useLMSLeadsByContact(contactId)` - Fetch leads linked to a specific contact
- `useLMSLeadsByCompany(companyId)` - Fetch leads linked to a specific company
- `useLMSLeadByEmail(email)` - Fetch lead by email (fallback lookup)

---

### 4. Component: `src/components/customers/LMSLeadsTab.tsx`

**Displays**:
- Plan badge (e.g., "Instructor Trial")
- Credits progress bar (used/total)
- Role and company size
- Use case and learning objectives
- Verification status icon
- Marketing consent status
- LMS registration date and sync date

---

### 5. Update: `src/components/customers/ContactHistoryTabs.tsx`

**Changes**:
- Import `LMSLeadsTab` component
- Add 8th tab trigger: "LMS"
- Add tab content with `LMSLeadsTab` component
- Update grid from `grid-cols-7` to `grid-cols-8`

---

## Webhook Usage

Once deployed, configure your LMS to POST to:

```
https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/lms-webhook
```

**Headers**:
```
x-api-key: <your-CRM_WEBHOOK_API_KEY-value>
Content-Type: application/json
```

---

## Technical Details

### Authentication Flow
```text
LMS System
    |
    | POST with x-api-key header
    v
lms-webhook Edge Function
    |
    ├── Validate API key against CRM_WEBHOOK_API_KEY secret
    ├── Parse and validate payload
    ├── Match existing contact by email
    ├── Match company by email domain
    ├── Upsert into lms_leads table
    └── Optionally create new contact
```

### Auto-linking Logic
1. **Contact matching**: Query contacts table by email + user_id
2. **Company matching**: Extract email domain, skip common providers (gmail, yahoo, etc.), match against companies.domains or companies.website
3. **Contact creation**: If no existing contact, create one with first_name, last_name, email, and "LMS Lead" label

---

## Security
- API key validation required for all requests
- Service role used for database operations (bypasses RLS)
- Input validation for email format
- Required field validation (email, crm_user_id)
