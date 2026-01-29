

# Plan: Google Calendar Integration

## Overview

Add Google Calendar integration to the existing Calendar nav item at `/calendar`. This will allow users to:
- View upcoming meetings and appointments
- Create new calendar events
- Schedule meetings with CRM contacts
- Link meetings to contacts/companies

## Architecture

The integration will leverage the existing Google OAuth flow (already set up for Gmail) by adding Calendar scopes. Events will be synced to a new `calendar_events` database table and linked to contacts/companies.

```text
Google OAuth Flow (Extended):
  1. User already connected Gmail OR connects fresh
  2. Add calendar scopes to OAuth request
  3. Store tokens in existing email_accounts table

Calendar Sync:
  1. Edge function fetches events via Google Calendar API
  2. Matches attendees to CRM contacts by email
  3. Stores events in database
  4. Frontend displays in Calendar page
```

---

## Required Google API Scopes

Add these scopes to your Google Cloud Console OAuth consent screen:

| Scope | Purpose |
|-------|---------|
| `https://www.googleapis.com/auth/calendar` | Full calendar access |
| `https://www.googleapis.com/auth/calendar.events` | Create/edit events |

---

## Database Changes

**New Table: `calendar_events`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| account_id | uuid | FK to email_accounts |
| google_event_id | text | Google Calendar event ID |
| contact_id | uuid | FK to contacts (nullable) |
| company_id | uuid | FK to companies (nullable) |
| title | text | Event title |
| description | text | Event description |
| location | text | Event location |
| start_time | timestamptz | Event start |
| end_time | timestamptz | Event end |
| all_day | boolean | Is all-day event |
| attendees | text[] | Attendee emails |
| meeting_link | text | Video call link (Meet/Zoom) |
| status | text | confirmed/tentative/cancelled |
| created_at | timestamptz | Record created |
| updated_at | timestamptz | Record updated |

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/Calendar.tsx` | Main calendar page with month/week/day views |
| `src/components/calendar/CalendarView.tsx` | Calendar grid component |
| `src/components/calendar/EventCard.tsx` | Event display card |
| `src/components/calendar/CreateEventModal.tsx` | Modal to create/edit events |
| `src/components/calendar/ConnectCalendar.tsx` | Calendar connection UI (if not connected) |
| `src/hooks/useCalendarEvents.ts` | React Query hooks for calendar data |
| `supabase/functions/sync-calendar/index.ts` | Fetch events from Google Calendar |
| `supabase/functions/create-calendar-event/index.ts` | Create event in Google Calendar |
| `supabase/functions/update-calendar-event/index.ts` | Update/delete events |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add /calendar route |
| `src/components/inbox/ConnectGmail.tsx` | Add calendar scopes to OAuth request |
| `supabase/config.toml` | Register new edge functions |

---

## Implementation Details

### 1. Update OAuth Scopes

Modify `ConnectGmail.tsx` to include Calendar scopes:

```typescript
const scope = encodeURIComponent(
  "https://www.googleapis.com/auth/gmail.readonly " +
  "https://www.googleapis.com/auth/gmail.send " +
  "https://www.googleapis.com/auth/userinfo.email " +
  "https://www.googleapis.com/auth/calendar " +
  "https://www.googleapis.com/auth/calendar.events"
);
```

### 2. Calendar Page Features

**Views:**
- Month view (default) - Grid with event dots
- Week view - Time-based grid
- Day view - Detailed schedule

**Functionality:**
- Click date to create event
- Click event to view details
- Drag to reschedule (future enhancement)
- Filter by linked contacts

### 3. Create Event Modal

Fields:
- Title (required)
- Date/Time picker
- Duration or end time
- Location
- Description
- Attendees (select from contacts or type email)
- Add video meeting link option

### 4. Edge Functions

**sync-calendar:**
- Fetches events from Google Calendar API
- Matches attendees to contacts by email
- Upserts into calendar_events table

**create-calendar-event:**
- Creates event in Google Calendar
- Adds attendees
- Stores in database with contact link

---

## UI Components

### Calendar Page Layout

```text
+----------------------------------+
|  Calendar     < Jan 2026 >  + New Event |
+----------------------------------+
| Sun | Mon | Tue | Wed | Thu | Fri | Sat |
+-----+-----+-----+-----+-----+-----+-----+
|     |  1  |  2  |  3  |  4  |  5  |  6  |
|     | [*] |     |     |[**]|     |     |
+-----+-----+-----+-----+-----+-----+-----+
|  7  |  8  |  9  | 10  | 11  | 12  | 13  |
|     |     | [*] |     |     |     |     |
+-----+-----+-----+-----+-----+-----+-----+
```

[*] = Event indicators

### Event Card

```text
+----------------------------------+
| 10:00 AM - Meeting with John     |
| @ Zoom                           |
| [John Smith] [Acme Corp]         |
+----------------------------------+
```

---

## Implementation Steps

1. **Database Setup**
   - Create `calendar_events` table with RLS policies

2. **Update OAuth**
   - Add calendar scopes to ConnectGmail component
   - Users may need to re-authorize to grant calendar access

3. **Create Edge Functions**
   - `sync-calendar` - Fetch and store events
   - `create-calendar-event` - Create new events
   - `update-calendar-event` - Update/delete events

4. **Build Calendar UI**
   - Create Calendar page with month/week/day views
   - Create event display components
   - Create event creation modal

5. **Add Route**
   - Add /calendar route to App.tsx

6. **Test Flow**
   - Verify OAuth works with new scopes
   - Test event sync
   - Test event creation

---

## Contact/Company Integration

Events will be automatically linked to contacts when:
- Attendee email matches a contact's email
- User manually links event to contact/company

This allows viewing a contact's meeting history in their detail drawer.

---

## Summary

| Component | Count |
|-----------|-------|
| New Pages | 1 |
| New Components | 4-5 |
| New Edge Functions | 3 |
| New Database Tables | 1 |
| Modified Files | 3 |

