
# Complete Sequences Email Automation Implementation

## Problems Found

1. **No cron job triggers the sequence processor** - `process-sequences` edge function exists but is NEVER called
2. **Placeholder sequences with fake template IDs** - 5 seeded sequences have template references like `welcome_intro`, `upsell_recommendations` which are NOT valid UUIDs
3. **No immediate sending option** - When enrolling, user must wait for the cron job (which doesn't exist)

---

## Solution Overview

### 1. Add Cron Job to Trigger Sequence Processing

Create a scheduled job that runs every 5 minutes to process pending sequence emails:

```sql
SELECT cron.schedule(
  'process-sequences-job',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/process-sequences',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### 2. Remove Placeholder Sequences

Delete the 5 seeded sequences that have fake template IDs:
- "Welcome New Customers" (template: `welcome_intro`)  
- "Cross-sell / Upsell" (template: `upsell_recommendations`)
- "Webinar Invitation" (template: `webinar_invite`)
- "Email Course / Training" (template: `course_lesson1`)
- "Content Offer Follow-up" (template: `content_delivery`)

Keep only user-created sequences with valid template UUIDs.

### 3. Add Immediate "Send Now" Button

When a contact is enrolled in a sequence with `day: 0`, trigger immediate email send instead of waiting for the cron job.

### 4. Add Manual Trigger Button

Add a "Process Now" button on the Sequences page to manually trigger pending emails for testing.

---

## Files to Modify

| File | Changes |
|------|---------|
| Database (SQL) | Add cron job for `process-sequences`, delete placeholder sequences |
| `src/pages/Sequences.tsx` | Remove placeholder Resend config notice, add "Process Now" button |
| `src/hooks/useSequences.ts` | Add hook to manually trigger sequence processing |
| `src/components/sequences/EnrollContactModal.tsx` | Trigger immediate send for day 0 steps |

---

## Technical Implementation

### Step 1: Database Changes

Run SQL to:
1. Add cron job
2. Delete placeholder sequences with invalid template IDs

```sql
-- Delete placeholder sequences with fake template IDs
DELETE FROM sequences 
WHERE id IN (
  'd58bedee-ab4c-46bf-b683-7f4baf162cf4',  -- Welcome New Customers
  '07c6ffb9-ccab-468f-9b9e-42c7f704b8c0',  -- Cross-sell / Upsell  
  '14d71219-b6ff-475f-882f-268eb50b470a',  -- Webinar Invitation
  '35c97305-017b-493a-b65f-f7148f3cb492',  -- Email Course / Training
  '0a56ce39-8204-4e6a-96cb-89c5519d2023'   -- Content Offer Follow-up
);

-- Add cron job to process sequences every 5 minutes
SELECT cron.schedule(
  'process-sequences-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/process-sequences',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdldHFjeG5qc29odGxhZ3NjbWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NjMyNDksImV4cCI6MjA3NzMzOTI0OX0.pUQXYLcuZXvYpwUPZGmwAcPW_eMf3J7qEtuTQYh-xZs"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### Step 2: Add Manual Trigger Hook

```typescript
// In useSequences.ts
export function useProcessSequences() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-sequences");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const results = data?.results;
      if (results) {
        toast.success(`Processed ${results.processed} enrollments, sent ${results.sent} emails`);
      } else {
        toast.success("Sequence processing triggered");
      }
    },
    onError: (error) => {
      toast.error("Failed to process sequences: " + error.message);
    },
  });
}
```

### Step 3: Add "Process Now" Button in UI

```tsx
// In Sequences.tsx header
const processSequences = useProcessSequences();

<Button 
  variant="outline" 
  onClick={() => processSequences.mutate()}
  disabled={processSequences.isPending}
>
  {processSequences.isPending ? (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  ) : (
    <Play className="mr-2 h-4 w-4" />
  )}
  Process Now
</Button>
```

### Step 4: Trigger Immediate Send on Enrollment (Day 0)

```typescript
// In EnrollContactModal.tsx after successful enrollment
if (sequence?.steps[0]?.day === 0) {
  // Trigger immediate processing for day 0 emails
  await supabase.functions.invoke("process-sequences");
}
```

---

## Result After Implementation

1. **Cron job** will run every 5 minutes and send due emails automatically
2. **No more placeholder sequences** - only real sequences with valid templates will show
3. **Manual trigger** button allows immediate testing
4. **Day 0 emails** send immediately when contact is enrolled
5. **Real email delivery** via Resend for enrolled contacts

---

## Verification Steps

1. Check existing enrollment gets processed
2. Enroll a new contact in your "Welcome series" → should send immediately
3. Check `sequence_emails` table for sent records
4. Verify email arrives in recipient's inbox
