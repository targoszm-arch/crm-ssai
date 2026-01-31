
# Plan: Fix Customer Navigation, Email Tracking Visibility, and LinkedIn Add to CRM

## Summary

This plan addresses three issues:
1. **Customer Click in Organisation View**: Contact cards don't open the contact detail drawer
2. **Email Tracking Visibility**: Open/click stats exist but aren't visible in contact detail view
3. **Add LinkedIn Contact to CRM**: No way to create a contact from unlinked LinkedIn messages

---

## Issue 1: Customer Click Navigation in Organisation Detail

### Current Problem
In `OrganisationDetail.tsx`, contact cards (lines 223-249) are rendered as static divs with no click handler. When you click on a customer within an organisation, nothing happens.

### Solution
Add state management and click handlers to open the `ContactDetail` drawer when clicking on a contact card.

### Changes Required

**File: `src/components/customers/OrganisationDetail.tsx`**

1. Import the `ContactDetail` component
2. Add state: `selectedContact` and `contactDetailOpen`
3. Make contact cards clickable with `cursor-pointer` and hover effect
4. Add `onClick` handler to set selected contact and open the detail drawer
5. Render `ContactDetail` component after the Organisation Sheet

```text
Before:
+----------------------+
| John Smith           |  <-- Static, no cursor change
| Sales Director       |
+----------------------+

After:
+----------------------+
| John Smith       >   |  <-- Clickable, cursor-pointer, hover effect
| Sales Director       |
+----------------------+
       |
       v (onClick)
Opens ContactDetail Sheet
```

---

## Issue 2: Email Tracking Visibility in Contact Detail

### Current Implementation Status

Email tracking IS fully implemented in the backend:

| Component | Status | Location |
|-----------|--------|----------|
| Tracking pixel injection | Working | `send-email/index.ts` |
| Link click wrapping | Working | `send-email/index.ts` |
| Open tracking endpoint | Working | `track-email-open/index.ts` |
| Click tracking endpoint | Working | `track-email-click/index.ts` |
| Database columns | Exist | `emails.open_count`, `emails.click_count`, `emails.first_opened_at` |
| Inbox list badges | Visible | `EmailList.tsx` lines 297-313 |

### Problem
The `EmailsTab.tsx` in the Contact Detail view shows emails but doesn't display tracking statistics. The same badge pattern used in `EmailList.tsx` should be added here.

### Solution
Add tracking badges to `EmailsTab.tsx` matching the design from `EmailList.tsx`.

**File: `src/components/customers/EmailsTab.tsx`**

1. Import `Eye` and `MousePointerClick` icons from lucide-react
2. Add a Tooltip import for showing first_opened_at timestamp
3. Display open/click badges on outbound emails that are tracked

```text
Current EmailsTab card:
+----------------------------------+
| [>] Meeting follow-up            |
| To: John | Jan 15, 2024          |
| Hey, just following up on...     |
+----------------------------------+

Enhanced EmailsTab card:
+----------------------------------+
| [>] Meeting follow-up            |
| To: John | Jan 15, 2024          |
| Hey, just following up on...     |
| [Eye 3] [Click 1]                | <-- New tracking badges
+----------------------------------+
```

---

## Issue 3: Add LinkedIn Contact to CRM

### Current Problem
When viewing a LinkedIn message from someone not in the CRM, you can only link them to an existing contact via a dropdown. There's no way to create a new contact directly from the LinkedIn message view.

### Solution
Add an "Add to CRM" button in the `LinkedInMessageView` that creates a new contact pre-filled with data from the LinkedIn connection, then optionally triggers an enrichment to fill in additional details.

### Data Available from LinkedIn Sync

From `linkedin_connections` table:
- `name` - Full name (can split into first/last)
- `headline` - Job title
- `profile_url` - LinkedIn URL
- `company` - Company name

From `linkedin_messages` table:
- `sender_name` - Fallback name
- `profile_url` - LinkedIn URL
- `company_name` - Company name

### Changes Required

**File: `src/components/inbox/LinkedInMessageView.tsx`**

1. Import `useCreateContact` hook
2. Add "Add to CRM" button next to "Link to contact" dropdown
3. Show button only when there's no linked contact
4. On click:
   - Parse sender name into first/last name
   - Create contact with available fields (name, title from headline, linkedin_url, company lookup)
   - Link the new contact to the linkedin_connection
   - Optionally trigger AI enrichment to populate more fields
   - Show success toast with link to view contact

### User Flow

```text
LinkedIn Message View (unlinked contact)
+------------------------------------------+
| [LinkedIn Icon] Chris Ferner             |
| Marketing Director at TechCorp           |
|------------------------------------------|
| Link to contact: [Select...]             |
|                                          |
| [+ Add to CRM]  <-- NEW BUTTON           |
|------------------------------------------|
| [Reply in LinkedIn] [AI Draft]           |
+------------------------------------------+

Click "Add to CRM":
1. Creates contact with:
   - first_name: "Chris"
   - last_name: "Ferner" 
   - title: "Marketing Director at TechCorp" (from headline)
   - linkedin_url: profile_url
   - Searches for/creates company "TechCorp" if specified

2. Links linkedin_connection.contact_id to new contact

3. Shows toast: "Contact created! View Chris Ferner"

4. (Optional) Auto-triggers enrichment to fill email, phone, etc.
```

---

## Technical Implementation Details

### File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `OrganisationDetail.tsx` | Modify | Add ContactDetail import, state, click handlers |
| `EmailsTab.tsx` | Modify | Add tracking badges (Eye, Click icons) |
| `LinkedInMessageView.tsx` | Modify | Add "Add to CRM" button with contact creation logic |

### No Database Changes Required

All necessary tables and columns already exist:
- `contacts` table has all required fields
- `linkedin_connections.contact_id` for linking
- `companies` table for company lookup/creation

### Dependencies

No new packages needed - all required components and icons are already available in the project.
