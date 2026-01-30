

# LMS Webhook Integration for Leads

## Overview

Create a new webhook endpoint to receive user registration data from your LMS (SkillStudio) and store it in an enhanced `lms_leads` table. Each lead will be linked to both a Contact (Customer) and Company (Organisation) in the CRM.

---

## Data Mapping

Based on the LMS data structure you provided:

| LMS Field | Database Column | Type |
|-----------|-----------------|------|
| User (name) | `full_name` | text |
| Email | `email` | text |
| Role | `role` | text |
| Company Size | `company_size` | text |
| Use Case | `use_case` | text |
| Learning Objectives | `learning_objectives` | text |
| Marketing | `marketing_consent` | boolean |
| Verified | `verified` | boolean |
| Created | `lms_created_at` | timestamp |
| Credits | `credits_used`, `credits_total` | integer |
| Plan | `plan` | text |
| contact_id | Foreign key to contacts | uuid |
| company_id | Foreign key to companies | uuid |

---

## Part 1: Create `lms_leads` Table

A new dedicated table for LMS leads (separate from the generic `leads` table) with proper relationships:

```sql
CREATE TABLE public.lms_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,  -- CRM owner (multi-tenant)
    
    -- LMS user info
    lms_user_id text UNIQUE,  -- External ID from LMS
    full_name text NOT NULL,
    email text NOT NULL,
    role text,
    
    -- Company details from LMS
    company_size text,
    use_case text,
    learning_objectives text,
    
    -- Status fields
    marketing_consent boolean DEFAULT false,
    verified boolean DEFAULT false,
    
    -- Plan & credits
    plan text,
    credits_used integer DEFAULT 0,
    credits_total integer DEFAULT 0,
    
    -- Timestamps
    lms_created_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    -- Relationships to CRM entities
    contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
    company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
    
    -- Additional metadata
    raw_payload jsonb,
    source text DEFAULT 'skillstudio'
);

-- Indexes for performance
CREATE INDEX idx_lms_leads_user_id ON lms_leads(user_id);
CREATE INDEX idx_lms_leads_email ON lms_leads(email);
CREATE INDEX idx_lms_leads_contact_id ON lms_leads(contact_id);
CREATE INDEX idx_lms_leads_company_id ON lms_leads(company_id);

-- RLS policies (user-scoped)
ALTER TABLE lms_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lms_leads"
ON lms_leads FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lms_leads"
ON lms_leads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lms_leads"
ON lms_leads FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lms_leads"
ON lms_leads FOR DELETE TO authenticated
USING (auth.uid() = user_id);
```

---

## Part 2: Create Webhook Endpoint

Create `supabase/functions/lms-webhook/index.ts`:

```text
+---------------------+
|  LMS (SkillStudio)  |
+---------------------+
          |
          | POST /lms-webhook
          | Header: x-lms-api-key
          |
          v
+---------------------+
| lms-webhook Edge Fn |
|   - Verify API key  |
|   - Parse payload   |
|   - Match contact   |
|   - Match company   |
|   - Upsert lead     |
+---------------------+
          |
          v
+---------------------+
|    lms_leads table  |
+---------------------+
```

### Webhook Features:
1. **API Key Authentication** - Verify `x-lms-api-key` header against stored secret
2. **Upsert Logic** - Update if lead exists (by email), insert if new
3. **Auto-linking** - Match existing contacts by email, companies by name/domain
4. **Auto-create** - Optionally create new Contact if not found

### Expected Payload Format:

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

## Part 3: Add Secret for Webhook Authentication

A new secret `LMS_WEBHOOK_KEY` will be required to authenticate incoming webhook requests. This prevents unauthorized access to the endpoint.

---

## Part 4: Update Frontend

### Add LMS Leads Tab to Contact Detail

Modify `src/components/customers/ContactDetail.tsx` to show linked LMS leads:

```tsx
// Add new tab for LMS Leads
<TabsTrigger value="lms-leads">LMS Leads</TabsTrigger>

// Tab content
<TabsContent value="lms-leads">
  <LMSLeadsTab contactId={contact.id} />
</TabsContent>
```

### Create LMS Leads Tab Component

Create `src/components/customers/LMSLeadsTab.tsx`:

Displays:
- Plan badge
- Credits (used/total)
- Role & company size
- Use case
- Verification status
- Marketing consent
- LMS registration date

---

## Part 5: Create Leads Hook

Create `src/hooks/useLMSLeads.ts`:

```typescript
// Query leads by contact or company
export function useLMSLeadsByContact(contactId: string) { ... }
export function useLMSLeadsByCompany(companyId: string) { ... }
export function useAllLMSLeads() { ... }
```

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | `lms_leads` table with RLS |
| `supabase/functions/lms-webhook/index.ts` | Create | Webhook endpoint |
| `supabase/config.toml` | Modify | Add `lms-webhook` function config |
| Secret: `LMS_WEBHOOK_KEY` | Add | API key for webhook auth |
| `src/hooks/useLMSLeads.ts` | Create | React Query hooks |
| `src/components/customers/LMSLeadsTab.tsx` | Create | Display component |
| `src/components/customers/ContactDetail.tsx` | Modify | Add LMS Leads tab |
| `src/integrations/supabase/types.ts` | Auto-update | TypeScript types |

---

## Webhook Usage

Once deployed, configure your LMS to POST to:

```
https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/lms-webhook
```

Headers:
```
x-lms-api-key: <your-secret-key>
Content-Type: application/json
```

---

## Security Considerations

1. **API Key Validation** - Webhook validates `x-lms-api-key` header
2. **RLS Policies** - User-scoped access to lms_leads table
3. **Service Role** - Webhook uses service role to bypass RLS for upserts
4. **Input Validation** - Email format validation before processing
5. **Idempotent** - Upsert by email prevents duplicate entries

