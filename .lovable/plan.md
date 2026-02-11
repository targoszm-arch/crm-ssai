# Fix Inbox Sync: Faster Sync + Better Feedback

## Problems

1. Clicking "Sync" triggers a massive 2000-email / 100-day sync that's slow and hits resource limits
2. Toast message says "Synced 0 new emails (1271 already synced)" -- confusing and unhelpful
3. No visual distinction between "checking for new mail" and "nothing new"

## Changes

### 1. Make manual Sync lightweight (src/components/inbox/EmailList.tsx)

- Change `handleSync` to use `maxResults: 100, daysBack: 5` instead of `2000 / 100`
- This matches the auto-sync behavior and is fast (checks only recent emails)
- Don't delete or overwrite existing emails. Leave them in the inbox.
- Sort the emails by the most recent ones on the top

### 2. Improve toast messages (src/components/inbox/EmailList.tsx + src/pages/Inbox.tsx)

- When new emails found: "Inbox Updated -- 3 new emails synced"
- When no new emails: "Inbox is up to date" (no count of skipped emails)
- On error: keep the destructive toast with the actual error message

### 3. Auto-sync toast cleanup (src/pages/Inbox.tsx)

- Auto-sync on page load: only show toast if new emails were found (already does this)
- Keep the "Syncing..." header indicator so the user sees activity

## Technical Details

### File: `src/components/inbox/EmailList.tsx`

- Line 87: Change `maxResults: 2000, daysBack: 100` to `maxResults: 100, daysBack: 1`
- Lines 89-94: Update success toast:
  - If `data.syncedCount > 0`: show "Inbox Updated" with count
  - If `data.syncedCount === 0`: show "Inbox is up to date" (simple, no skipped count)

### File: `src/pages/Inbox.tsx`

- Lines 90-98: Auto-sync toast already only fires when `syncedCount > 0` -- no change needed there
- The "Syncing..." indicator in the header already works correctly

### No edge function changes

The sync-emails edge function itself works fine. The issue is purely the parameters being sent and the toast messages shown.