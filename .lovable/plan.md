

# Fix Meet Alfred Replies & Gmail 100-Day Sync

## Problems Identified

### 1. Meet Alfred Replies Not Syncing

The edge function logs reveal:
```
Skipping reply - no LinkedIn ID found (x100 times)
```

The Meet Alfred API is returning replies, but the `person.linkedin_profile_url` field is either:
- Empty/null in the API response
- Located in a different field than expected

Current code requires a valid LinkedIn URL to sync - we need to save replies regardless.

### 2. Gmail Syncing Too Few Emails

Current state:
- sync-emails function fetches only **20 emails** per sync (hardcoded limit on line 121)
- Only fetches messages from INBOX label
- No date filtering - just grabs most recent

Requested:
- Sync **100 days** of email history
- Include **Inbox + Sent** 
- Up to **2,000 emails** per sync

---

## Solution

### Part 1: Fix Meet Alfred Replies

**File**: `supabase/functions/meetalfred-sync/index.ts`

Changes:
1. Remove the requirement for LinkedIn URL - save replies even when missing
2. Use composite identifier: `person.first_name + person.last_name + reply_detected_on`
3. Store person info directly in message if no LinkedIn ID available
4. Log the actual API response structure to debug field locations

```text
Before:
  if (!linkedinId) {
    console.log("Skipping reply - no LinkedIn ID found");
    continue;
  }

After:
  // Generate a unique sender ID even without LinkedIn URL
  const senderId = linkedinId || 
    `meetalfred_${reply.id}` || 
    `unknown_${Date.now()}`;
  
  // Always save the reply
```

### Part 2: Gmail 100-Day Sync

**File**: `supabase/functions/sync-emails/index.ts`

Changes:
1. Accept a `daysBack` parameter (default 100)
2. Increase email limit to 2,000
3. Fetch from both INBOX and SENT labels
4. Use Gmail's `after:` search operator to filter by date
5. Add pagination to fetch all messages (Gmail returns max 500 per request)

```text
Key changes:
- maxResults parameter: 50 -> 2000
- Add: daysBack parameter (default 100)
- Add: labelIds = INBOX,SENT
- Add: Gmail query: after:YYYY/MM/DD
- Add: Pagination loop to fetch all pages
- Process limit: 20 -> all fetched (with reasonable safeguard)
```

**File**: `src/hooks/useEmails.ts`

Update mutation to pass new parameters:
```typescript
mutationFn: async ({ 
  accountId, 
  maxResults = 2000,
  daysBack = 100 
}: { 
  accountId: string; 
  maxResults?: number;
  daysBack?: number;
}) => {
```

---

## Implementation Details

### Meet Alfred Reply Fix

| Current Approach | New Approach |
|-----------------|--------------|
| Skip if no LinkedIn URL | Always save |
| Require connection record | Create connection OR use synthetic ID |
| linkedin_id as sender | fallback to `meetalfred_{reply.id}` |

The `sender_linkedin_id` field will store either:
- Actual LinkedIn ID (if available)
- `meetalfred_{reply_id}` (fallback identifier)

### Gmail Sync Changes

| Parameter | Current | New |
|-----------|---------|-----|
| maxResults | 50 (20 processed) | 2000 |
| Labels | INBOX only | INBOX + SENT |
| Date filter | None | Last 100 days |
| Processing limit | 20 | All fetched |

Gmail API query will be:
```
q=after:2025/10/22  // 100 days back from today
labelIds=INBOX,SENT
maxResults=500      // per page, loop for more
```

---

## Files to Modify

1. **supabase/functions/meetalfred-sync/index.ts**
   - Remove LinkedIn URL requirement for replies
   - Generate fallback sender identifiers
   - Log raw API response for debugging

2. **supabase/functions/sync-emails/index.ts**
   - Add `daysBack` parameter
   - Change `maxResults` default to 2000
   - Add SENT label to fetched messages
   - Add date filter using Gmail `after:` query
   - Add pagination to fetch all pages
   - Remove 20-email processing limit

3. **src/hooks/useEmails.ts**
   - Add `daysBack` parameter to `useSyncEmails` mutation

4. **src/components/inbox/EmailList.tsx**
   - Pass `daysBack: 100` when triggering sync

