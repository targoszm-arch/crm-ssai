

# Plan: OpenAI Auto-Enrichment + Google Inbox Integration

## Overview

This plan covers two major features:
1. **OpenAI Auto-Enrichment** - Automatically enrich company and contact details using AI
2. **Google Inbox Integration** - Connect Gmail to view/send emails linked to contacts and companies

---

## Part 1: OpenAI Auto-Enrichment

### What It Does

Add an "Enrich" button to contact and company detail drawers that uses OpenAI to:
- Research and fill missing company details (industry, employee count, description, website)
- Research and fill missing contact details (job title, seniority level, LinkedIn URL)
- Generate AI insights (buying signals, pain points, interest level)

### Architecture

```text
User clicks "Enrich" button
        |
        v
Frontend calls Edge Function
        |
        v
Edge Function:
  1. Constructs prompt with existing data
  2. Calls OpenAI API
  3. Parses structured response
  4. Updates database record
        |
        v
Frontend receives updated data
```

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/enrich-company/index.ts` | Edge function to enrich company data via OpenAI |
| `supabase/functions/enrich-contact/index.ts` | Edge function to enrich contact data via OpenAI |
| `src/lib/api/enrichment.ts` | Frontend API client for enrichment functions |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/customers/ContactDetail.tsx` | Add "Enrich with AI" button |
| `src/components/customers/OrganisationDetail.tsx` | Add "Enrich with AI" button |
| `src/hooks/useCompanies.ts` | Add `useUpdateCompany` mutation |
| `supabase/config.toml` | Register new edge functions |

### Secret Required

- **OPENAI_API_KEY** - OpenAI API key for GPT-4 access

### Edge Function Logic (Enrich Company)

```typescript
// Prompt template
const prompt = `Given this company information, research and provide enriched data:
Company Name: ${company.company_name}
Website: ${company.website || 'unknown'}
Current Industry: ${company.industry || 'unknown'}

Return JSON with:
- description (2-3 sentences about what the company does)
- industry (if not set)
- employee_range (e.g., "11-50", "51-200")
- estimated_arr (in USD if publicly available)
- categories (comma-separated list of business categories)`;
```

---

## Part 2: Google Inbox Integration

### What It Does

Add a new "Inbox" section to the navigation that:
- Shows Gmail emails linked to CRM contacts
- Allows composing and sending emails
- Automatically links emails to contacts based on email addresses
- Displays email history in contact/company detail drawers

### Architecture

```text
Google OAuth Flow:
  1. User clicks "Connect Gmail"
  2. Redirect to Google OAuth consent
  3. Receive auth code, exchange for tokens
  4. Store tokens in database

Email Sync:
  1. Edge function fetches emails via Gmail API
  2. Matches sender/recipient to contacts by email
  3. Stores email metadata in database
  4. Frontend displays in Inbox and contact drawers
```

### Database Changes

**New Table: `email_accounts`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Auth user reference |
| provider | text | "google" |
| email_address | text | Gmail address |
| access_token | text | OAuth access token (encrypted) |
| refresh_token | text | OAuth refresh token (encrypted) |
| expires_at | timestamptz | Token expiry |
| created_at | timestamptz | Created timestamp |

**New Table: `emails`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| account_id | uuid | FK to email_accounts |
| gmail_id | text | Gmail message ID |
| thread_id | text | Gmail thread ID |
| contact_id | uuid | FK to contacts (nullable) |
| company_id | uuid | FK to companies (nullable) |
| subject | text | Email subject |
| snippet | text | Email preview |
| from_email | text | Sender email |
| from_name | text | Sender name |
| to_emails | text[] | Recipients |
| received_at | timestamptz | Email timestamp |
| is_read | boolean | Read status |
| direction | text | 'inbound' or 'outbound' |
| labels | text[] | Gmail labels |

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/Inbox.tsx` | Main inbox page with email list |
| `src/components/inbox/EmailList.tsx` | Email list component |
| `src/components/inbox/EmailThread.tsx` | Email thread/conversation view |
| `src/components/inbox/ComposeEmail.tsx` | Email composer modal |
| `src/components/inbox/ConnectGmail.tsx` | Gmail connection UI |
| `src/hooks/useEmails.ts` | Email-related React Query hooks |
| `src/hooks/useEmailAccounts.ts` | Email account hooks |
| `supabase/functions/google-auth-callback/index.ts` | OAuth callback handler |
| `supabase/functions/sync-emails/index.ts` | Fetch and sync emails from Gmail |
| `supabase/functions/send-email/index.ts` | Send email via Gmail API |

### Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add /inbox route |
| `src/components/layout/Sidebar.tsx` | Add Inbox nav item with Mail icon |
| `src/components/layout/MobileNavigation.tsx` | Add Inbox to mobile nav |
| `src/components/customers/ContactDetail.tsx` | Add email history section |
| `src/components/customers/OrganisationDetail.tsx` | Add email history section |
| `supabase/config.toml` | Register new edge functions |

### Secrets Required

- **GOOGLE_CLIENT_ID** - Google OAuth client ID
- **GOOGLE_CLIENT_SECRET** - Google OAuth client secret

### Navigation Update

```typescript
// New item in mainNavItems array (Sidebar.tsx)
{
  icon: <Mail size={18} />,
  label: "Inbox",
  path: "/inbox"
}
```

### Inbox Page Features

1. **Email List View**
   - Filter by: All, Linked to CRM, Unlinked
   - Search emails
   - Show sender, subject, snippet, timestamp
   - Click to open thread view

2. **Thread View**
   - Full email content
   - Reply inline
   - Link to contact/company
   - View contact profile sidebar

3. **Compose**
   - Rich text editor
   - Select recipients from contacts
   - Auto-link sent emails to contacts

---

## Implementation Steps

### Phase 1: OpenAI Auto-Enrichment

1. Add OPENAI_API_KEY secret
2. Create `enrich-company` edge function
3. Create `enrich-contact` edge function
4. Create frontend API client
5. Add `useUpdateCompany` hook
6. Add "Enrich with AI" button to OrganisationDetail
7. Add "Enrich with AI" button to ContactDetail
8. Deploy and test

### Phase 2: Google Inbox Integration

1. Create database tables (email_accounts, emails)
2. Add Google OAuth secrets
3. Create OAuth callback edge function
4. Create email sync edge function
5. Create send email edge function
6. Create Inbox page and components
7. Update navigation
8. Add email sections to detail drawers
9. Deploy and test

---

## Security Considerations

- OAuth tokens stored securely in database
- Edge functions validate auth before API calls
- RLS policies on email tables (users see only their own)
- API keys never exposed to frontend

---

## Summary

| Feature | Components | Edge Functions | Database |
|---------|------------|----------------|----------|
| Auto-Enrichment | 2 buttons, 1 API client | 2 functions | No changes |
| Inbox | 6 new components, 1 page | 3 functions | 2 new tables |

