

# Plan: Fireflies Meeting Notes Integration

## Overview

Integrate Fireflies.ai to automatically receive meeting summaries and display them in the Contact profile. Add new collapsible, editable sections to the contact detail drawer: **All, Activities, Notes, Emails, Engagement, Deals, Leads**.

---

## Architecture

```text
+-------------------+       Webhook POST        +------------------------+
|  Fireflies.ai     | ------------------------> | fireflies-webhook      |
|  (after meeting)  |                          | Edge Function          |
+-------------------+                          +------------------------+
                                                         |
                                               1. Receive meetingId
                                               2. Fetch full transcript via GraphQL API
                                               3. Match participants to contacts
                                               4. Store in meeting_notes table
                                                         |
                                                         v
                                               +------------------------+
                                               | Supabase Database      |
                                               | meeting_notes table    |
                                               +------------------------+
                                                         |
                                                         v
                                               +------------------------+
                                               | Contact Detail Drawer  |
                                               | Notes Section          |
                                               +------------------------+
```

---

## Implementation Components

### 1. Database Migration

Create a new `meeting_notes` table to store Fireflies meeting summaries:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| contact_id | uuid | FK to contacts |
| company_id | uuid | FK to companies (optional) |
| fireflies_meeting_id | text | Fireflies transcript ID |
| title | text | Meeting title |
| meeting_date | timestamptz | When the meeting occurred |
| duration_minutes | integer | Meeting duration |
| participants | text[] | Array of participant emails |
| overview | text | AI-generated overview |
| action_items | jsonb | Structured action items |
| summary | text | Short summary/gist |
| bullet_gist | text | Bullet point summary |
| transcript_url | text | Link to full transcript |
| audio_url | text | Link to audio |
| meeting_type | text | Type of meeting |
| raw_data | jsonb | Full Fireflies payload |
| created_at | timestamptz | Record creation |
| updated_at | timestamptz | Last update |

### 2. Edge Function: `fireflies-webhook`

Receives webhook from Fireflies when a meeting transcript is ready:

| Step | Action |
|------|--------|
| 1 | Verify webhook signature (x-hub-signature) |
| 2 | Extract meetingId from payload |
| 3 | Call Fireflies GraphQL API to fetch full transcript |
| 4 | Extract participant emails from response |
| 5 | Match emails to contacts in database |
| 6 | Insert meeting note linked to matched contact(s) |

**Fireflies GraphQL Query:**
```graphql
query Transcript($transcriptId: String!) {
  transcript(id: $transcriptId) {
    title
    date
    duration
    participants
    summary {
      overview
      shorthand_bullet
      action_items
      gist
      meeting_type
    }
    transcript_url
    audio_url
  }
}
```

### 3. Required Secret

| Secret Name | Purpose |
|-------------|---------|
| FIREFLIES_API_KEY | Authenticate with Fireflies GraphQL API |
| FIREFLIES_WEBHOOK_SECRET | Verify incoming webhooks (optional but recommended) |

### 4. UI: ContactDetail Drawer Redesign

Transform the current drawer into a tabbed/collapsible section layout similar to the screenshot:

**New Tab Structure:**

| Tab | Content |
|-----|---------|
| All | Combined timeline of all activities |
| Activities | Tasks, calendar events linked to contact |
| Notes | Meeting notes from Fireflies + manual notes |
| Emails | Emails linked to this contact |
| Engagement | Interaction metrics and history |
| Deals | Deals linked to this contact |
| Leads | Leads associated with contact |

**Notes Tab Display:**
Each meeting note card shows:
- Date and time
- Meeting host and participants
- Title with link to transcript
- Overview (collapsible)
- Meeting Type
- Action Items (collapsible list)
- Summary

### 5. New Files

| File | Purpose |
|------|---------|
| `supabase/functions/fireflies-webhook/index.ts` | Webhook handler for Fireflies |
| `src/hooks/useMeetingNotes.ts` | Hook to fetch meeting notes by contact |
| `src/components/customers/ContactHistoryTabs.tsx` | Tabbed history section component |
| `src/components/customers/MeetingNoteCard.tsx` | Individual meeting note display |
| `src/components/customers/ActivitiesTab.tsx` | Activities list component |
| `src/components/customers/NotesTab.tsx` | Notes with Fireflies + manual |
| `src/components/customers/EmailsTab.tsx` | Contact emails list |
| `src/components/customers/DealsTab.tsx` | Linked deals |
| `src/components/customers/LeadsTab.tsx` | Linked leads |

### 6. Modified Files

| File | Changes |
|------|---------|
| `src/components/customers/ContactDetail.tsx` | Add History section with tabs below existing info |

---

## Technical Details

### Fireflies Webhook Flow

```text
1. Fireflies sends POST to https://<project>.supabase.co/functions/v1/fireflies-webhook
   Body: { meetingId: "xxx", eventType: "Transcription completed" }

2. Edge function fetches full transcript from Fireflies GraphQL API:
   POST https://api.fireflies.ai/graphql
   Authorization: Bearer FIREFLIES_API_KEY

3. Parse participants array, match to contacts by email

4. Insert into meeting_notes with matched contact_id
```

### Contact Matching Logic

```text
For each participant email in meeting:
  1. Query contacts WHERE email ILIKE participant_email
  2. If found, create meeting_note linked to that contact
  3. If multiple contacts share meeting, create note for each
```

### Manual Notes

The Notes section will also support adding manual notes (text) that are not from Fireflies. These can be stored in a separate `contact_notes` table or use an existing mechanism.

---

## Setup Instructions for User

After implementation, you'll need to:

1. Get your Fireflies API key from app.fireflies.ai/integrations
2. Add the webhook URL in Fireflies Developer Settings:
   `https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/fireflies-webhook`
3. Optionally set a webhook secret for signature verification

---

## Summary

| Component | What It Does |
|-----------|--------------|
| Database table | Store Fireflies meeting summaries |
| Edge function | Receive webhooks, fetch transcripts, match to contacts |
| New UI tabs | Display Activities, Notes, Emails, Engagement, Deals, Leads |
| Meeting note cards | Rich display of meeting data with collapsible sections |

