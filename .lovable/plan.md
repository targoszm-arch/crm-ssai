

# Fix Meet Alfred Sync: Missing Database Constraints

## Problem Identified

The sync found 100 replies but synced 0 because the database is missing the unique constraints needed for upsert operations.

### Current State
| Table | Upsert Conflict Key | Constraint Exists? |
|-------|---------------------|-------------------|
| linkedin_messages | sender_linkedin_id, message_timestamp | No |
| linkedin_connections | linkedin_id | No |
| leads | email | No |

Without these constraints, the upsert operation fails silently and no records are inserted.

---

## Solution

### Step 1: Add Database Constraints

Create unique constraints/indexes on the columns used for conflict resolution:

```sql
-- Unique constraint for linkedin_connections
CREATE UNIQUE INDEX IF NOT EXISTS linkedin_connections_linkedin_id_key 
ON linkedin_connections(linkedin_id);

-- Unique constraint for linkedin_messages (composite)
CREATE UNIQUE INDEX IF NOT EXISTS linkedin_messages_sender_timestamp_key 
ON linkedin_messages(sender_linkedin_id, message_timestamp);

-- Unique constraint for leads (partial - only where email is not null)
CREATE UNIQUE INDEX IF NOT EXISTS leads_email_key 
ON leads(email) WHERE email IS NOT NULL;
```

### Step 2: Update Edge Function Error Handling

Add explicit error logging to capture any database errors during upsert:

```typescript
// In the reply sync loop
const { error: upsertError } = await supabase.from("linkedin_messages").upsert(...);
if (upsertError) {
  console.error("Message upsert error:", upsertError);
  results.replies.errors.push(upsertError.message);
} else {
  results.replies.synced++;
}
```

### Step 3: Alternative Insert Strategy

As a fallback, change from upsert to a select-then-insert pattern:

```typescript
// Check if message exists first
const { data: existing } = await supabase
  .from("linkedin_messages")
  .select("id")
  .eq("sender_linkedin_id", linkedinId)
  .eq("message_timestamp", reply.reply_detected_on)
  .single();

if (!existing) {
  // Insert new message
  await supabase.from("linkedin_messages").insert({...});
  results.replies.synced++;
}
```

---

## Implementation Steps

1. **Database Migration**: Add the three unique constraints
2. **Edge Function Update**: Improve error handling and use insert instead of upsert as primary method
3. **Re-deploy and Test**: Trigger sync again to verify replies are now being stored

---

## Technical Details

### Why This Happened
PostgreSQL's `ON CONFLICT` clause requires a unique constraint or index to identify conflicts. Without it, the database doesn't know how to detect duplicates, so the upsert either fails or does nothing.

### Why Leads Worked (Partially)
The leads upsert used `ignoreDuplicates: true`, which likely caused Supabase to fall back to a simple insert strategy. Since there were no existing records, new ones were created. However, running the sync again would likely create duplicates.

### Files to Modify
- Database migration (new SQL migration)
- `supabase/functions/meetalfred-sync/index.ts`

