
# Fix: Meet Alfred Not Syncing Actual Reply Content

## Root Cause
The `meetalfred-sync` edge function is calling the **wrong API endpoint**. It currently uses:
```
/api/integrations/webhook/new-reply-detected
```

This is a **webhook push endpoint** that only returns minimal notification data (reply IDs and timestamps). It does NOT return the actual message content, person details, or campaign information - which is why everything shows as "Unknown" with "Reply received from campaign" as placeholder text.

## Solution
Switch to the correct **Get Replies** API endpoint that returns full reply data including:
- Actual message text from the lead
- Person information (name, LinkedIn profile URL, headline)
- Campaign details (name, type)

---

## Technical Changes

### 1. Update Edge Function API Endpoint
**File**: `supabase/functions/meetalfred-sync/index.ts`

Change the replies endpoint from:
```
new-reply-detected
```
to the proper get-replies endpoint.

Based on Meet Alfred's API documentation patterns, the correct endpoint structure is:
```
https://app.meetalfred.com/api/v1/replies
```
OR
```
https://meetalfred.com/api/integrations/webhook/replies
```

The function will try the documented get-replies pattern and log the full response structure for debugging.

### 2. Add Raw Payload Storage
**Database Migration**: Add `raw_payload` column to `linkedin_messages` table

```sql
ALTER TABLE linkedin_messages 
ADD COLUMN IF NOT EXISTS raw_payload jsonb;
```

This stores the complete API response for each synced reply so we never lose data again.

### 3. Update Data Extraction Logic
The edge function will:
1. Log the FULL raw API response for debugging (to understand the actual structure Meet Alfred returns)
2. Store the raw payload in the database
3. Extract message text, sender name, profile URL from the correct fields in the response
4. Support pagination for last 30 days of replies

### 4. Implement Proper Pagination for 30-Day Backfill
Add logic to page through replies until we've covered the last 30 days:
- Call the API with incrementing page numbers
- Stop when we hit replies older than 30 days or run out of data
- Track sync progress and report totals

---

## Updated Edge Function Logic

```typescript
// Try the correct API endpoint for fetching replies
const repliesUrl = `https://meetalfred.com/api/integrations/webhook/replies?webhook_key=${webhookKey}&page=${page}&per_page=${perPage}`;

// If that fails, try alternative endpoint patterns
// Log FULL response structure for debugging

// For each reply, extract:
const messageText = reply.message || reply.text || reply.content || "No message";
const firstName = reply.person?.first_name || reply.lead?.first_name || "";
const lastName = reply.person?.last_name || reply.lead?.last_name || "";
const profileUrl = reply.person?.linkedin_profile_url || reply.lead?.profile_url || "";
const campaignName = reply.campaign?.name || reply.sequence?.name || "";

// Store raw payload for debugging
raw_payload: reply
```

---

## Updated UI Display
**File**: `src/components/inbox/LinkedInMessageView.tsx`

Update to show:
- Sender name from `message.sender_name` (fallback to connection name)
- Actual message text from `message.message_text`
- Campaign badge showing `message.campaign_name` if available
- "Reply in LinkedIn" button using `message.profile_url`

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/meetalfred-sync/index.ts` | Fix API endpoint, add full response logging, store raw payload, implement 30-day pagination |
| Database migration | Add `raw_payload` jsonb column to `linkedin_messages` |
| `src/components/inbox/LinkedInMessageView.tsx` | Display actual message content and sender info |
| `src/hooks/useLinkedInMessages.ts` | Update interface to include `raw_payload` |

---

## Expected Outcome After Fix
When you click "Sync Meet Alfred":
1. The function calls the correct API endpoint
2. Full reply data is fetched including actual message text
3. The inbox shows real sender names (not "meetalfred_reply_xxx")
4. The inbox shows actual reply content (not "Reply received from campaign")
5. "Reply in LinkedIn" button links to the actual person's profile
6. Raw payloads are stored for debugging
