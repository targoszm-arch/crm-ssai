

# Realtime Email Sync, Mark Read/Unread, and Daily MeetAlfred Cron

## Overview

This plan implements four key features:
1. **Realtime email sync** - Automatically sync last 24 hours of emails when opening the mailbox
2. **Mark as read/unread** - Update read status locally and sync to Gmail server
3. **Daily MeetAlfred sync** - Schedule automatic sync at 9am using pg_cron
4. **Realtime database updates** - Subscribe to email table changes for instant UI updates

---

## Feature 1: Realtime Sync on Mailbox Open

### What Happens
When a user navigates to the Inbox page with an email account connected, the system will:
1. Automatically trigger a lightweight sync (last 24 hours, max 100 emails)
2. Show a subtle loading indicator during sync
3. Refresh the email list with any new messages

### Implementation

**File: `src/pages/Inbox.tsx`**
- Add `useEffect` that triggers sync when `activeTab === "email"` and account exists
- Use `useSyncEmails` with parameters `{ daysBack: 1, maxResults: 100 }`
- Add state to track if initial sync is happening

**File: `src/hooks/useEmails.ts`**
- Add Supabase realtime subscription to `emails` table
- When new emails are inserted/updated, automatically refetch

---

## Feature 2: Mark as Read/Unread with Gmail Sync

### What Happens
1. User clicks an email - it automatically marks as read
2. User can manually mark emails as read or unread
3. Both actions sync the status to Gmail via the API
4. Visual indicator (bold text, colored background) reflects read state

### New Edge Function: `mark-email-read`

Creates a new edge function that:
1. Receives email ID and read status (true/false)
2. Updates local database
3. Calls Gmail API to modify labels:
   - Mark as read: Remove UNREAD label
   - Mark as unread: Add UNREAD label

### UI Changes

**File: `src/components/inbox/EmailList.tsx`**
- Add right-click context menu or button to toggle read status
- Call new mutation when clicked

**File: `src/components/inbox/EmailThread.tsx`**
- Auto-mark as read when email is opened (with 1 second delay)

**File: `src/hooks/useEmails.ts`**
- Add `useMarkEmailRead` mutation hook

---

## Feature 3: Daily MeetAlfred Sync at 9am

### What Happens
A scheduled cron job runs every day at 9:00 AM UTC that:
1. Calls the `meetalfred-sync` edge function
2. Syncs campaigns, replies, connections, and leads
3. Logs results for monitoring

### Implementation

Using Supabase pg_cron extension to schedule the job:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily sync at 9am UTC
SELECT cron.schedule(
  'meetalfred-daily-sync',
  '0 9 * * *',  -- 9:00 AM every day
  $$
  SELECT net.http_post(
    url := 'https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/meetalfred-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Feature 4: Realtime Database Subscription

### What Happens
The email list subscribes to Supabase realtime for the `emails` table:
- New emails appear instantly
- Read status updates reflect immediately
- No manual refresh needed

### Implementation

**File: `src/hooks/useEmails.ts`**
- Add `useEffect` with Supabase channel subscription
- Listen for INSERT and UPDATE events on `emails` table
- Invalidate query cache when changes detected

---

## Technical Details

### New Edge Function: `mark-email-read`

```typescript
// supabase/functions/mark-email-read/index.ts
// Receives: { emailId, isRead, accountId }
// 1. Updates emails table set is_read = isRead
// 2. Gets email gmail_id
// 3. Calls Gmail API: 
//    POST /gmail/v1/users/me/messages/{id}/modify
//    Body: { addLabelIds: ["UNREAD"] } or { removeLabelIds: ["UNREAD"] }
// 4. Returns success
```

### Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/Inbox.tsx` | Modify | Add auto-sync on mount |
| `src/hooks/useEmails.ts` | Modify | Add realtime subscription, mark read mutation |
| `src/components/inbox/EmailList.tsx` | Modify | Add mark read/unread buttons |
| `src/components/inbox/EmailThread.tsx` | Modify | Auto-mark as read on open |
| `supabase/functions/mark-email-read/index.ts` | Create | Sync read status to Gmail |
| `supabase/config.toml` | Modify | Add mark-email-read function config |

### Database Changes
- No schema changes needed (is_read column already exists)
- Run SQL to set up pg_cron job for MeetAlfred

---

## User Experience

### Opening Inbox
1. User navigates to /inbox
2. Small "Syncing..." indicator appears briefly
3. Any new emails from last 24 hours appear in list
4. Realtime subscription keeps list updated

### Reading an Email
1. User clicks an email
2. Email detail opens
3. After 1 second, email is automatically marked as read
4. Gmail server is notified
5. Email list updates to show read state

### Manually Changing Read Status
1. User right-clicks email or clicks menu icon
2. Selects "Mark as unread" or "Mark as read"
3. Local database updates immediately
4. Gmail server syncs in background
5. List reflects new status

### Daily MeetAlfred Sync
- Runs automatically at 9am UTC every day
- No user action required
- LinkedIn messages and connections stay current

---

## Edge Cases Handled

1. **Offline/failed sync**: Toast notification shows error, data remains as-is
2. **Token expired**: Edge function refreshes token before making Gmail calls
3. **Already synced emails**: Skipped efficiently (no duplicates)
4. **Multiple browser tabs**: Realtime keeps all tabs in sync

