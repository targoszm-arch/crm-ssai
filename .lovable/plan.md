
# Signup Abandonment Recovery Campaign Implementation

## Overview
Transform the Cart Abandonment page into a unified "Recovery" hub with a new "Signup Abandonment" tab that displays unverified LMS users. Enable users to select contacts from this list and enroll them in recovery email sequences directly, with real-time analytics on campaign performance.

---

## Architecture

```text
Recovery Page (CartAbandonment.tsx)
     |
     +-- Abandoned Carts Tab (existing)
     |
     +-- Signup Abandonment Tab (NEW)
     |        |
     |        +-- Summary Metrics Cards
     |        +-- Unverified Users Table (filtered from External LMS)
     |        +-- Bulk Selection + Actions
     |
     +-- Recovery Campaigns Tab (enhanced)
              |
              +-- Campaign Cards with Analytics
              +-- Create Campaign Modal (links to Sequences)
              +-- Enrollments from Abandonment List
```

---

## Files to Create/Modify

### 1. New Component: `src/components/recovery/SignupAbandonmentTab.tsx`

**Purpose**: Display and manage unverified LMS signups

**Features**:
- Summary metric cards:
  - Total unverified signups
  - This week's abandonments
  - Recoverable (marketing consent = true)
  - Recovery rate percentage
- Filterable table columns: Name, Email, Signup Type, Plan, Days Pending, Marketing Consent
- Row selection with checkboxes for bulk enrollment
- Individual actions: Enroll in Sequence, View Details
- Bulk action bar: "Enroll Selected in Sequence" button

### 2. New Component: `src/components/recovery/EnrollAbandonmentModal.tsx`

**Purpose**: Modal to enroll selected unverified users into a recovery sequence

**Features**:
- Sequence selector dropdown (filters for recovery/signup trigger types)
- Preview of selected contacts count
- Option to create contacts in CRM if they don't exist
- Confirmation and enrollment execution
- Progress indicator during bulk enrollment

### 3. New Component: `src/components/recovery/RecoveryCampaignsTab.tsx`

**Purpose**: Display active recovery campaigns with analytics

**Features**:
- Campaign cards showing:
  - Sequence name and status
  - Enrolled count from abandonment list
  - Open/click rates
  - Recovery rate (verified after enrollment)
- "Create Recovery Campaign" button linking to Sequence Builder with pre-filled trigger type
- Quick stats: Total recovered, Active campaigns, Avg recovery rate

### 4. Update: `src/pages/CartAbandonment.tsx`

**Changes**:
- Rename page title to "Recovery Center"
- Add third tab: "Signup Abandonment"
- Integrate new components
- Update tab layout to 3 columns

### 5. Update: `src/hooks/useExternalLMSCustomers.ts`

**Changes**:
- Add `verified?: boolean` filter parameter
- Add hook variant: `useUnverifiedLMSCustomers()` - pre-filtered for verified=false
- Add derived stats calculation (counts by status)

### 6. New Hook: `src/hooks/useRecoveryAnalytics.ts`

**Purpose**: Track recovery campaign performance

**Features**:
- Query sequence enrollments filtered by LMS-originated contacts
- Calculate recovery rate: users who verified after enrollment
- Track conversion funnel: Enrolled → Opened → Clicked → Recovered

### 7. Update: `src/components/sequences/SequenceBuilderSheet.tsx`

**Changes**:
- Add new trigger type: `signup_abandonment` with label "Signup Abandonment Recovery"
- Pre-select this trigger when opened from Recovery page

---

## Implementation Details

### Signup Abandonment Detection Logic

The external LMS endpoint already provides `verified: false` for incomplete signups. We filter client-side:

```typescript
const unverifiedUsers = customers?.filter(c => c.verified === false);
```

### Enrollment Flow

1. User selects unverified LMS leads from the abandonment table
2. Opens "Enroll in Recovery Sequence" modal
3. Selects an existing sequence or creates new one
4. For each selected user:
   - Check if CRM contact exists (by email)
   - Create contact if missing, with label "LMS Abandonment"
   - Enroll contact in selected sequence
5. Trigger immediate processing for Day 0 emails

### Recovery Tracking

Track users who verify after receiving recovery emails:
- Add `source: 'recovery_campaign'` metadata to enrollment
- Compare enrollment timestamp with LMS `verified_at` timestamp (if available)
- Calculate recovery rate: (verified after enrollment / total enrolled) * 100

### Analytics Integration

Leverage existing sequence analytics but add:
- Filter by enrollment source (recovery campaigns)
- Add "Recovered" status to recipient filters
- Show recovery funnel visualization

---

## UI/UX Considerations

1. **Tab Navigation**: Keep existing cart abandonment for e-commerce, add parallel LMS signup tab
2. **Bulk Actions**: Floating action bar appears when rows selected
3. **Campaign Creation**: "Create Campaign" opens Sequence Builder in a modal/sheet with recovery trigger pre-selected
4. **Real-time Updates**: Poll for verification status changes to update recovery metrics

---

## Database Considerations

No new tables required. Existing structures support this:
- `sequence_enrollments.metadata` - Store `{ source: 'signup_abandonment', lms_email: '...' }`
- `contacts.labels` - Add "LMS Abandonment" label for tracking
- `activities` - Log enrollment activities with `activity_type: 'recovery_enrollment'`

---

## Technical Notes

1. **No backend changes needed** - All data comes from existing external LMS endpoint
2. **Contact creation** uses existing CRM contacts table with RLS
3. **Sequence enrollment** uses existing `useEnrollContact` hook
4. **Analytics** extends existing sequence analytics infrastructure
