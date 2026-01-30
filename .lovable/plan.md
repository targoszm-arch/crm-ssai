

# Comprehensive CRM Enhancement: Inbox, Labels, Tracking, and Deals Module

## Overview

This plan implements a major feature set across multiple areas of the CRM:

1. **Inbox Enhancements** - Sync indicator, folder navigation, view modes, bulk actions, filters
2. **Shared Labels System** - Reusable label components for emails, contacts, organizations
3. **Email Tracking** - Open/click tracking with analytics
4. **Rich Text Composer** - Image, video, and attachment embedding
5. **Deals Module** - Full pipeline management with Kanban board

---

## Part 1: Inbox UI Enhancements

### 1.1 Auto-Sync Visual Indicator

Add a visible syncing indicator in the inbox header.

**Changes to `src/pages/Inbox.tsx`:**
- Show animated spinner with "Syncing..." text next to conversation count
- Display when `isAutoSyncing` or `syncEmails.isPending` is true

### 1.2 Folder Navigation (Inbox, Drafts, Outbox, Sent, Archive)

**Database Migration:**
```sql
ALTER TABLE emails ADD COLUMN folder text DEFAULT 'inbox';
```

**New Component: `src/components/inbox/InboxSidebar.tsx`**
- Vertical folder list: Inbox (95), Drafts (97), Outbox, Sent, Archive
- Show unread counts per folder
- Style similar to screenshot with icons

**Update `EmailList.tsx`:**
- Accept `folder` prop to filter emails
- Update query to filter by folder

### 1.3 Two View Modes (Split vs Full)

**Split View** (current): Email list on left, detail on right
**Full View** (like screenshot): Email list takes full width, email opens in Sheet

**Implementation:**
- Add view toggle button in header (icons for split/full)
- Store preference in localStorage
- In full view mode, render EmailThread inside a Sheet dialog

### 1.4 Bulk Selection & Actions

**Update `EmailList.tsx`:**
- Add master checkbox in header (select all visible)
- Add individual checkboxes on each email row
- Track selected email IDs in state

**New Component: `src/components/inbox/BulkActionBar.tsx`**
- Floating bar when items selected
- Actions: Mark Read, Mark Unread, Archive, Add Label
- Uses updated edge function for bulk operations

**Update Edge Function `mark-email-read`:**
- Accept array of email IDs for bulk operations

### 1.5 Enhanced Read/Unread Styling

**Update `EmailList.tsx` and `LinkedInMessageList.tsx`:**
- Unread: Bold text, `bg-primary/5` background, blue dot indicator
- Read: Normal weight, no background
- Consistent styling across both email and LinkedIn tabs

---

## Part 2: Shared Labels System

### 2.1 New Shared Components

**`src/components/shared/LabelBadge.tsx`:**
- Single label display with color
- Compact variant for tables/lists

**`src/components/shared/LabelSelector.tsx`:**
- Multi-select dropdown for choosing labels
- Search/filter capability
- "Add label" option to create new
- Used in filters and email detail

### 2.2 Add Labels to Emails

**Database Migration:**
```sql
ALTER TABLE emails ADD COLUMN email_labels text;
```

**Update `EmailThread.tsx`:**
- Show labels in email header
- Add label selector to add/remove labels

**Update `EmailList.tsx`:**
- Display labels as colored badges on email rows

---

## Part 3: Advanced Email Filters

### 3.1 Filter Bar Component

**New Component: `src/components/inbox/InboxFilters.tsx`**

Matching the screenshot design with three dropdown buttons:

**Follow-up Status Dropdown:**
- "You haven't replied"
  - For 0-3 days
  - For 4-7 days
  - For 8-30 days
- Logic: Latest email in thread is inbound and unresponded

**Labels Dropdown:**
- Multi-select with search
- Show all available labels with colors
- "+ Add label" option at bottom

**Filters Dropdown:**
- Unread
- Linked with a deal
- Linked with an open deal
- Not linked with a deal
- Tracked emails
- From an existing contact
- Only with attachments

### 3.2 Filter Logic in `useEmails.ts`

Add new filter parameters:
- `folder`: inbox | drafts | sent | archive
- `followUpStatus`: 0-3 | 4-7 | 8-30 days
- `labels`: string[] for multi-select
- `isUnread`: boolean
- `hasTracking`: boolean
- `linkedWithDeal`: boolean | null
- `hasAttachments`: boolean

---

## Part 4: Email Tracking

### 4.1 Database Changes

**New Table: `email_tracking_events`**
```sql
CREATE TABLE email_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES emails(id),
  contact_id uuid REFERENCES contacts(id),
  event_type text NOT NULL, -- 'open' or 'click'
  link_url text,
  user_agent text,
  ip_address text,
  occurred_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
```

**Update emails table:**
```sql
ALTER TABLE emails 
  ADD COLUMN is_tracked boolean DEFAULT false,
  ADD COLUMN open_count integer DEFAULT 0,
  ADD COLUMN click_count integer DEFAULT 0,
  ADD COLUMN first_opened_at timestamptz,
  ADD COLUMN last_opened_at timestamptz;
```

### 4.2 New Edge Functions

**`supabase/functions/track-email-open/index.ts`:**
- Returns 1x1 transparent PNG pixel
- Records open event in email_tracking_events
- Updates email open_count, first/last_opened_at
- Links to contact for analytics

**`supabase/functions/track-email-click/index.ts`:**
- Decodes destination URL from query param
- Records click event with link URL
- Redirects to actual destination
- Updates email click_count

### 4.3 Update send-email Function

**Modify `supabase/functions/send-email/index.ts`:**
- Accept `isTracked: boolean` parameter
- If tracked, inject tracking pixel before `</body>`:
  ```html
  <img src="https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/track-email-open?eid={email_id}" width="1" height="1" />
  ```
- Wrap links with tracking redirect:
  ```
  https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/track-email-click?eid={email_id}&url={encoded_url}
  ```

### 4.4 UI Updates

**Update `EmailList.tsx`:**
- Show tracking icons (eye for opens, mouse-pointer for clicks)
- Display counts on hover

**Update `ComposeEmail.tsx`:**
- Add "Enable tracking" toggle

### 4.5 Analytics Dashboard

**Update `src/pages/Dashboard.tsx` or create dedicated Analytics page:**

Add Email Engagement section:
- Total emails sent (from sequences + inbox)
- Open rate percentage
- Click rate percentage
- Engagement timeline chart

**Store on contacts:**
- Add `total_emails_received`, `total_opens`, `total_clicks` to contacts table
- Update on each tracking event

---

## Part 5: Rich Text Composer Enhancements

### 5.1 Add Media Embedding to RichTextComposer

**Update `src/components/shared/RichTextComposer.tsx`:**

Add new toolbar buttons:
- **Image** - Insert image from URL or upload
- **Video** - Embed video (YouTube, Vimeo, or direct URL)
- **Attachment** - Reference attached files

**New dialogs:**
- Image insert dialog (URL input, alt text)
- Video embed dialog (URL input, auto-detect provider)

### 5.2 Update EmailTemplateEditor

Apply same enhancements to `EmailTemplateEditor.tsx` for template editing.

---

## Part 6: Deals Module

### 6.1 Database Changes

**New Table: `pipelines`**
```sql
CREATE TABLE pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO pipelines (name, is_default) VALUES ('Enterprise Pipeline', true);
```

**New Table: `pipeline_stages`**
```sql
CREATE TABLE pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL,
  color text DEFAULT '#10b981',
  is_won boolean DEFAULT false,
  is_lost boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Default stages
INSERT INTO pipeline_stages (pipeline_id, name, position, color) VALUES
  ((SELECT id FROM pipelines WHERE is_default), 'Marketing Qualified', 0, '#6b7280'),
  ((SELECT id FROM pipelines WHERE is_default), 'Contact Made', 1, '#6b7280'),
  ((SELECT id FROM pipelines WHERE is_default), 'Sales Qualified', 2, '#22c55e'),
  ((SELECT id FROM pipelines WHERE is_default), 'Contact Made', 3, '#22c55e'),
  ((SELECT id FROM pipelines WHERE is_default), 'Demo Done', 4, '#22c55e'),
  ((SELECT id FROM pipelines WHERE is_default), '1st Follow Up', 5, '#f59e0b'),
  ((SELECT id FROM pipelines WHERE is_default), '2nd Follow Up', 6, '#f59e0b'),
  ((SELECT id FROM pipelines WHERE is_default), 'Intention to Buy', 7, '#3b82f6'),
  ((SELECT id FROM pipelines WHERE is_default), 'Closed Deal', 8, '#10b981');
```

**Update `deals` table:**
```sql
ALTER TABLE deals 
  ADD COLUMN pipeline_id uuid REFERENCES pipelines(id),
  ADD COLUMN position integer DEFAULT 0,
  ADD COLUMN source_channel text,
  ADD COLUMN source_channel_id text,
  ADD COLUMN lead_source text,
  ADD COLUMN labels text;

-- Set default pipeline for existing deals
UPDATE deals SET pipeline_id = (SELECT id FROM pipelines WHERE is_default);
```

### 6.2 New Deals Page

**New file: `src/pages/Deals.tsx`**

Layout matching screenshot:
- Header with "Deals" title, search, "+ Deal" button
- Pipeline selector dropdown (Enterprise Pipeline)
- View toggles (Kanban/List/Table/Forecast)
- Filter bar (Add condition, All open, Sort by)

**Kanban Board:**
- Columns for each pipeline stage
- Column headers show stage name, total value, deal count
- Deal cards with:
  - Deal name (title)
  - Organization name
  - Deal value range
  - Employee count
  - Industry
  - Days since creation (colored badge: green < 7d, yellow 7-14d, red > 14d)
  - Warning icon for stale deals

### 6.3 Deal Card Component

**New file: `src/components/deals/DealCard.tsx`**

Card contents:
- Title (deal name or contact name)
- Subtitle (organization)
- Value + currency
- Employee count
- Industry badge
- Time badge (7d, 4d, etc.)
- Warning indicator triangle

### 6.4 Pipeline Board Component

**New file: `src/components/deals/PipelineBoard.tsx`**

- Horizontal scrollable container
- Drag-and-drop between columns (using native HTML5 drag or @dnd-kit)
- Stage columns with header showing name + value total

### 6.5 Add Deal Modal

**New file: `src/components/deals/AddDealModal.tsx`**

Two-column form matching screenshot:

**Left Column:**
- Contact person (searchable dropdown)
- Organization (searchable dropdown)
- Title
- Value + Currency dropdown
- Pipeline selector
- Pipeline stage (visual chevron indicator)
- Labels (multi-select)
- Probability %
- Expected close date
- Source channel dropdown
- Source channel ID
- Lead source dropdown

**Right Column (Person Details):**
- Phone (with type selector)
- "+ Add phone" link
- Email (with type selector)
- "+ Add email" link
- Seniority level dropdown
- Function dropdown
- Postal address
- Job title
- Personalization notes
- Job profile dropdown
- Interest level dropdown
- Pain point detected dropdown
- LQS score

### 6.6 Pipeline Settings

**New file: `src/components/deals/PipelineSettings.tsx`**

Accessible via settings button:
- List of pipelines
- Edit pipeline name
- Manage stages:
  - Reorder (drag-and-drop)
  - Rename
  - Change color
  - Delete
  - Mark as won/lost
- Create new pipeline

### 6.7 Navigation Updates

**Update `src/components/layout/Sidebar.tsx`:**
- Add "Deals" item with DollarSign icon
- Position after Customers

**Update `src/App.tsx`:**
- Add route `/deals` pointing to Deals page

### 6.8 Create Deal from Customers

**Update `src/components/customers/ContactDetail.tsx`:**
- Add "Create Deal" button in header actions
- Opens AddDealModal pre-filled with contact and company

**Update `src/components/customers/OrganisationDetail.tsx`:**
- Add "Create Deal" button
- Opens AddDealModal pre-filled with company

### 6.9 Hooks

**New file: `src/hooks/useDeals.ts`:**
- `useDeals(filters)` - Fetch deals with pipeline/stage filters
- `useCreateDeal()` - Create new deal
- `useUpdateDeal()` - Update deal (including stage changes)
- `useDeleteDeal()` - Delete deal
- `useMoveDealToStage()` - Optimistic update for drag-and-drop

**New file: `src/hooks/usePipelines.ts`:**
- `usePipelines()` - Fetch all pipelines
- `usePipelineStages(pipelineId)` - Fetch stages for pipeline
- `useUpdatePipelineStage()` - Update stage order/name

---

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `src/components/shared/LabelBadge.tsx` | Single label display |
| `src/components/shared/LabelSelector.tsx` | Multi-select label picker |
| `src/components/inbox/InboxFilters.tsx` | Filter dropdowns |
| `src/components/inbox/InboxSidebar.tsx` | Folder navigation |
| `src/components/inbox/BulkActionBar.tsx` | Bulk selection actions |
| `src/pages/Deals.tsx` | Deals Kanban page |
| `src/components/deals/AddDealModal.tsx` | Create/edit deal form |
| `src/components/deals/DealCard.tsx` | Kanban card component |
| `src/components/deals/PipelineBoard.tsx` | Kanban board container |
| `src/components/deals/PipelineSettings.tsx` | Pipeline customization |
| `src/hooks/useDeals.ts` | Deals CRUD hooks |
| `src/hooks/usePipelines.ts` | Pipeline management hooks |
| `supabase/functions/track-email-open/index.ts` | Open tracking pixel |
| `supabase/functions/track-email-click/index.ts` | Click tracking redirect |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/Inbox.tsx` | Sync indicator, folder state, view mode toggle |
| `src/components/inbox/EmailList.tsx` | Checkboxes, bulk selection, folder filter, labels display |
| `src/components/inbox/LinkedInMessageList.tsx` | Enhanced read/unread styling |
| `src/components/inbox/EmailThread.tsx` | Label selector, tracking display |
| `src/components/inbox/ComposeEmail.tsx` | Tracking toggle |
| `src/components/shared/RichTextComposer.tsx` | Image/video/attachment embedding |
| `src/components/templates/EmailTemplateEditor.tsx` | Image/video embedding |
| `src/hooks/useEmails.ts` | New filter parameters, bulk operations |
| `src/components/layout/Sidebar.tsx` | Add Deals navigation |
| `src/App.tsx` | Add /deals route |
| `src/components/customers/ContactDetail.tsx` | Create Deal button |
| `src/components/customers/OrganisationDetail.tsx` | Create Deal button |
| `src/components/customers/DealsTab.tsx` | Link to deal details |
| `src/pages/Dashboard.tsx` | Email tracking analytics section |
| `supabase/functions/send-email/index.ts` | Tracking pixel/link injection |
| `supabase/functions/mark-email-read/index.ts` | Bulk operation support |
| `supabase/config.toml` | Add new edge functions |

### Database Migrations

1. Add `folder`, `email_labels`, tracking columns to `emails` table
2. Create `email_tracking_events` table with RLS
3. Create `pipelines` table with default data
4. Create `pipeline_stages` table with default stages
5. Update `deals` table with pipeline reference and new fields
6. Add contact engagement metrics columns

---

## Implementation Phases

**Phase 1 - Inbox Core (Day 1-2):**
- Sync indicator
- Folder navigation
- View mode toggle
- Bulk selection/actions

**Phase 2 - Labels & Filters (Day 2-3):**
- Shared label components
- Email labels support
- All filter dropdowns
- Filter logic in hooks

**Phase 3 - Email Tracking (Day 3-4):**
- Tracking database tables
- Track open/click edge functions
- Inject tracking in send-email
- Display tracking in UI
- Analytics dashboard section

**Phase 4 - Rich Text Enhancements (Day 4):**
- Image embedding
- Video embedding
- Attachment references

**Phase 5 - Deals Module (Day 4-6):**
- Database schema for pipelines
- Deals Kanban page
- Deal cards and board
- Add deal modal
- Create deal from customers
- Pipeline customization

---

## Technical Notes

### Drag-and-Drop
The Kanban board will use HTML5 native drag-and-drop initially for simplicity. If smoother animations are needed, we can add `@dnd-kit/core` as a dependency.

### View Mode Persistence
Store inbox view preference in localStorage using existing pattern from column preferences.

### Filter State
Use component state for filters, with option to extend to URL query parameters for shareable filter states in future.

### Real-time Updates
Extend existing realtime subscription pattern to deals table for live Kanban updates when deals are modified.

### Email Folder Assignment
The `sync-emails` edge function will be updated to set folder based on Gmail labels (INBOX, SENT, DRAFT maps to our folders).

