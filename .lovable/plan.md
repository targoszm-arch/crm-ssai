

# Enhanced Email Experience + Google Analytics Lead Intelligence

## Overview

Four major enhancements to the Inbox system:

1. **Fetch Rich HTML Email Bodies** - Store and display full HTML content
2. **In-Thread Email Reply** - Reply directly without separate compose
3. **AI-Powered Reply Suggestions** - OpenAI generates contextual reply drafts
4. **Google Analytics Lead Visits** - Identify which leads visited your website

---

## Part 1: Fetch Full HTML Email Bodies

### Problem
Currently, emails sync with `body_html: null` - only the snippet is stored. The Gmail API returns body data in a nested multipart structure that requires recursive extraction.

### Solution

**File: `supabase/functions/sync-emails/index.ts`**

Add recursive body extraction:

```text
New function: extractEmailBody(payload)
  - Traverse payload.parts recursively
  - Look for mimeType === "text/html" first
  - Fallback to mimeType === "text/plain"
  - Decode base64url data to string
  - Handle nested multipart/alternative and multipart/related

Flow:
1. Fetch message with format=full (already done)
2. Extract HTML body: extractEmailBody(msgData.payload, "text/html")
3. Fallback to text body if no HTML
4. Store in body_html column
```

### Gmail API Payload Structure
```text
payload:
  mimeType: "multipart/mixed"
  parts:
    - mimeType: "multipart/alternative"
      parts:
        - mimeType: "text/plain"
          body: { data: "base64url..." }
        - mimeType: "text/html"
          body: { data: "base64url..." }
    - mimeType: "application/pdf" (attachment)
```

---

## Part 2: In-Thread Reply with Rich Text

### Current State
- EmailThread.tsx has basic reply (plain textarea)
- Works but no formatting

### Solution

**File: `src/components/inbox/EmailThread.tsx`**

Enhance reply section:
- Replace plain Textarea with contentEditable div for basic formatting
- Include quoted original message below reply
- Show "Reply to: [sender email]" context
- Format outgoing reply as HTML

**File: `supabase/functions/send-email/index.ts`**

Already sends HTML content - just need to pass properly formatted body from frontend.

---

## Part 3: AI-Powered Reply Suggestions

### Approach

Create new edge function that:
1. Receives email context (original email body, sender info, contact data)
2. Calls OpenAI to generate contextual reply suggestions
3. Returns 2-3 reply options (professional, casual, brief)

**New File: `supabase/functions/generate-email-reply/index.ts`**

```text
Inputs:
  - emailId: string
  - tone: "professional" | "casual" | "brief"
  - context?: string (optional user notes)

Process:
  1. Fetch original email from DB (subject, body_html, sender info)
  2. Fetch contact/company data if linked
  3. Build prompt with email context
  4. Call OpenAI GPT-4o-mini
  5. Return suggested reply text

Prompt structure:
  - Original email content
  - Sender context (name, company, role)
  - Tone preference
  - CRM context (deal stage, last interaction, notes)
```

**File: `src/components/inbox/EmailThread.tsx`**

Add AI assistance button:
- "✨ Suggest Reply" button
- Dropdown for tone selection
- Loading state while generating
- Insert generated text into reply field

---

## Part 4: Google Analytics Lead Visits

### Requirements

To pull visitor data from GA4 and match it to leads:

1. **GA4 Property Access** - Need property ID and service account credentials
2. **User Identification** - GA4 can track by Client ID or User ID
3. **Data Matching** - Match GA4 visitors to CRM contacts

### Implementation

**New Secrets Required:**
- `GA4_PROPERTY_ID` - Your GA4 property ID (e.g., "properties/123456789")
- `GA4_SERVICE_ACCOUNT` - Service account JSON credentials

**New Database Table: `website_visits`**
```sql
CREATE TABLE website_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),
  company_id UUID REFERENCES companies(id),
  visitor_id TEXT NOT NULL,  -- GA4 client_id or user_id
  page_path TEXT,
  page_title TEXT,
  session_count INTEGER,
  total_pageviews INTEGER,
  first_visit TIMESTAMPTZ,
  last_visit TIMESTAMPTZ,
  traffic_source TEXT,
  medium TEXT,
  campaign TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**New File: `supabase/functions/sync-analytics/index.ts`**

```text
Process:
  1. Authenticate with GA4 Data API using service account
  2. Run report with dimensions:
     - clientId or userId (for matching)
     - pagePath
     - sessionSource
     - sessionMedium
  3. Run report with metrics:
     - sessions
     - screenPageViews
     - engagedSessions
  4. Match visitors to contacts:
     - By email if User ID is email
     - By custom dimension if you track lead email
  5. Store in website_visits table
  6. Update contact with visit_count, last_website_visit
```

**New UI Component: `src/components/customers/WebsiteActivityTab.tsx`**

Display in Contact Detail drawer:
- Recent page visits
- Total sessions
- Traffic source
- First/last visit dates
- Pages viewed timeline

---

## Implementation Order

### Phase 1: Email Body HTML (Quick Win)
1. Update `sync-emails/index.ts` with body extraction
2. Re-sync emails to populate body_html
3. EmailThread already renders HTML if present

### Phase 2: AI Reply Suggestions
1. Create `generate-email-reply/index.ts` edge function
2. Add "Suggest Reply" button to EmailThread
3. Hook selection to insert generated text

### Phase 3: Enhanced Reply UX
1. Add quoted message formatting
2. Basic rich text (bold/italic/links)
3. Better mobile experience

### Phase 4: Google Analytics Integration
1. Prompt for GA4 credentials
2. Create database table
3. Create sync edge function
4. Build UI component for activity display

---

## Technical Details

### Body Extraction Function

```typescript
function extractEmailBody(
  payload: { mimeType: string; body?: { data: string }; parts?: typeof payload[] },
  preferredMimeType: string = "text/html"
): string | null {
  // Direct body at this level
  if (payload.body?.data && payload.mimeType === preferredMimeType) {
    return decodeBase64Url(payload.body.data);
  }
  
  // Check nested parts recursively
  if (payload.parts) {
    for (const part of payload.parts) {
      const result = extractEmailBody(part, preferredMimeType);
      if (result) return result;
    }
  }
  
  return null;
}

// Usage in sync:
const htmlBody = extractEmailBody(msgData.payload, "text/html");
const textBody = extractEmailBody(msgData.payload, "text/plain");
const bodyHtml = htmlBody || (textBody ? `<pre>${textBody}</pre>` : null);
```

### AI Reply Prompt Template

```text
You are drafting an email reply. Be {tone} and professional.

ORIGINAL EMAIL:
From: {sender_name} <{sender_email}>
Subject: {subject}
Date: {date}

{email_body}

---
CONTEXT:
- Contact: {contact_name}, {contact_title} at {company}
- Relationship: {connection_strength}
- Deal Stage: {deal_stage}
- Last Note: {recent_note}

Draft a {tone} reply addressing their message.
Sign off as {user_name}.
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/sync-emails/index.ts` | Modify | Add HTML body extraction |
| `supabase/functions/generate-email-reply/index.ts` | Create | AI reply generation |
| `src/components/inbox/EmailThread.tsx` | Modify | Add AI suggest button, improve reply UX |
| `src/hooks/useEmailReply.ts` | Create | Hook for AI reply generation |
| `supabase/functions/sync-analytics/index.ts` | Create | GA4 data sync |
| `src/components/customers/WebsiteActivityTab.tsx` | Create | Display visitor activity |
| Database migration | Create | website_visits table + contact columns |

---

## Questions to Clarify

Before implementing Google Analytics:

1. **Do you have a GA4 property set up?** Need the Property ID
2. **How are users identified in GA4?** 
   - Anonymous (Client ID only)
   - User ID set via gtag when logged in
   - Custom dimension with email
3. **Service account access** - Need to create and share credentials

The first three features (HTML emails, reply improvements, AI suggestions) can proceed immediately. GA4 integration requires your credentials.

