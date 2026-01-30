

# Complete Fix: Sequence Email Content + Full Analytics Dashboard

## Critical Issues to Fix

### Issue 1: Wrong Email Content Being Sent
The `steps` field in sequences is double-encoded (JSON string inside JSONB), causing emails to use fallback content instead of your templates.

### Issue 2: Missing Analytics Dashboard
No `/analytics` route exists - needs full implementation matching your reference screenshots.

---

## Part 1: Fix Double-Encoded Steps (Edge Functions)

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/process-sequences/index.ts` | Parse steps if string before accessing |
| `supabase/functions/send-sequence-email/index.ts` | Same fix + add tracking pixel/link wrapping |

### process-sequences/index.ts Changes (Line 74)

```typescript
// BEFORE
const steps = sequence?.steps as any[];

// AFTER
let steps = sequence?.steps;
if (typeof steps === "string") {
  try {
    steps = JSON.parse(steps);
    console.log(`Parsed steps from string: ${steps.length} steps`);
  } catch (e) {
    console.error("Failed to parse steps string:", e);
    steps = [];
  }
}
```

### send-sequence-email/index.ts Changes (Line 107)

Same parsing fix plus add tracking functions:

```typescript
// Add tracking pixel injection
function injectTrackingPixel(html, sequenceEmailId, supabaseUrl) {
  const pixel = `<img src="${supabaseUrl}/functions/v1/track-sequence-open?seid=${sequenceEmailId}" width="1" height="1" />`;
  return html.includes('</body>') ? html.replace('</body>', `${pixel}</body>`) : html + pixel;
}

// Add link wrapping for click tracking
function wrapLinksForTracking(html, sequenceEmailId, supabaseUrl) {
  return html.replace(/href="(https?:\/\/[^"]+)"/gi, (match, url) => {
    if (url.includes('track-') || url.includes('unsubscribe')) return match;
    return `href="${supabaseUrl}/functions/v1/track-sequence-click?seid=${sequenceEmailId}&url=${encodeURIComponent(url)}"`;
  });
}
```

---

## Part 2: Create Tracking Edge Functions

### New Files

| File | Purpose |
|------|---------|
| `supabase/functions/track-sequence-open/index.ts` | Handle sequence email opens |
| `supabase/functions/track-sequence-click/index.ts` | Handle sequence link clicks |

Both functions will:
- Update `sequence_emails` table with `opened_at`/`clicked_at`
- Record events in `email_tracking_events` table
- Update contact `total_opens`/`total_clicks`

---

## Part 3: Database Schema Updates

### Add Columns to sequence_emails

```sql
ALTER TABLE sequence_emails 
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS bounce_type TEXT,
ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS spam_reported_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unique_opens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_opens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unique_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_clicks INTEGER DEFAULT 0;
```

### Fix Double-Encoded Steps Data

```sql
UPDATE sequences 
SET steps = (steps #>> '{}')::jsonb
WHERE jsonb_typeof(steps) = 'string';
```

---

## Part 4: Analytics Dashboard

### New Files to Create

| File | Purpose |
|------|---------|
| `src/pages/Analytics.tsx` | Main analytics page |
| `src/components/sequences/SequenceAnalyticsSheet.tsx` | Detailed analytics sheet |
| `src/hooks/useSequenceAnalytics.ts` | Analytics data hooks |

### Route Addition (App.tsx)

```tsx
import Analytics from "./pages/Analytics";

<Route
  path="/analytics"
  element={
    <AuthGuard>
      <AppShell>
        <Analytics />
      </AppShell>
    </AuthGuard>
  }
/>
```

### Analytics Page Layout (Matching Your Screenshots)

```text
+----------------------------------------------------------+
| Sequence Analytics                 [Select Sequence v]   |
+----------------------------------------------------------+
| [Overview]  [Recipients]                                 |
+----------------------------------------------------------+
|                                                          |
| OVERVIEW TAB:                                            |
|                                                          |
| Campaign Card:                                           |
| +------------------------------------------------------+ |
| | [Email Preview]  Subject: Welcome to Skill Studio... | |
| | Delivered: Jan 30, 2026                              | |
| +------------------------------------------------------+ |
|                                                          |
| Engagement:                                              |
| +------------------+------------------+------------------+|
| |   108           |     70           | [Bar Chart]     ||
| | Unique opens    | Unique clicks    | Open rate: 58%  ||
| | Total: 134      | Total: 87        | Click rate: 38% ||
| +------------------+------------------+------------------+|
|                                                          |
| Delivery:                                                |
| +----------+----------+----------+----------+            |
| |   186    |    6     |    1     |    0     |            |
| |Delivered | Bounced  |Unsub     | Spam     |            |
| +----------+----------+----------+----------+            |
|                                                          |
| Performance Over Time:                                   |
| [Hourly v]                                               |
| +------------------------------------------------------+ |
| |     Line Chart: Opens vs Clicks over time            | |
| +------------------------------------------------------+ |
|                                                          |
| Links Performance:                                       |
| +------------------------------------------------------+ |
| | Link URL              | Unique Clicks | % of clicks  | |
| | skillstudio.ai/start  |      45       |    64%       | |
| | skillstudio.ai/demo   |      25       |    36%       | |
| +------------------------------------------------------+ |
|                                                          |
+----------------------------------------------------------+
|                                                          |
| RECIPIENTS TAB:                                          |
|                                                          |
| [Delivered(186)] [Opened(108)] [Clicked(70)] [Bounced(6)]|
|                                                          |
| +------------------------------------------------------+ |
| | Name           | Email              | Opens | Last   | |
| | John Smith     | john@example.com   |   3   | 2h ago | |
| | Jane Doe       | jane@example.com   |   1   | 5h ago | |
| +------------------------------------------------------+ |
|                                                          |
| Bounced View shows:                                      |
| +----------+----------+----------+----------+            |
| |    2     |    2     |    1     |    1     |            |
| |  Hard    |  Soft    |Temporary | Blocked  |            |
| +----------+----------+----------+----------+            |
|                                                          |
+----------------------------------------------------------+
```

### Analytics Hook (useSequenceAnalytics.ts)

```typescript
interface SequenceAnalytics {
  // Delivery
  totalDelivered: number;
  totalBounced: number;
  hardBounces: number;
  softBounces: number;
  temporaryBounces: number;
  blockedBounces: number;
  totalUnsubscribed: number;
  totalSpamReports: number;
  
  // Engagement
  uniqueOpens: number;
  totalOpens: number;
  uniqueClicks: number;
  totalClicks: number;
  openRate: number;
  clickRate: number;
  clickThroughRate: number;
  
  // Recipients data
  recipients: RecipientData[];
  
  // Time series for chart
  performanceOverTime: { time: string; opens: number; clicks: number }[];
  
  // Link performance
  linkStats: { url: string; uniqueClicks: number; percentage: number }[];
}
```

---

## Part 5: Update Sequences Page

Add "View Analytics" option to sequence dropdown menu:

```tsx
<DropdownMenuItem onClick={() => handleViewAnalytics(sequence)}>
  <BarChart3 className="mr-2 h-4 w-4" />
  View Analytics
</DropdownMenuItem>
```

---

## Files Summary

| Category | File | Action |
|----------|------|--------|
| Edge Function | `process-sequences/index.ts` | Modify - parse steps |
| Edge Function | `send-sequence-email/index.ts` | Modify - parse steps + tracking |
| Edge Function | `track-sequence-open/index.ts` | Create |
| Edge Function | `track-sequence-click/index.ts` | Create |
| Database | SQL Migration | Add columns + fix data |
| Page | `src/pages/Analytics.tsx` | Create |
| Component | `src/components/sequences/SequenceAnalyticsSheet.tsx` | Create |
| Hook | `src/hooks/useSequenceAnalytics.ts` | Create |
| Route | `src/App.tsx` | Add /analytics route |
| Page | `src/pages/Sequences.tsx` | Add analytics menu item |

---

## Expected Results

After implementation:

1. **Correct email content**: Templates fetch correctly, no more "Message from us"
2. **Email tracking**: Opens and clicks tracked for sequence emails
3. **Analytics page at /analytics**: Full dashboard with engagement/delivery metrics
4. **Per-sequence analytics**: View detailed stats for any sequence
5. **Recipients view**: See who opened, clicked, bounced with filters
6. **Performance charts**: Line graphs showing opens/clicks over time
7. **Link tracking**: See which links get the most clicks

