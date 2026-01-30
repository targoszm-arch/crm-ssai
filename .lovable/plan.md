

# Plan: Connect Backend to Sequences Page

## Problem Summary
The Sequences page displays data correctly, but all interactive actions are placeholder buttons with no click handlers. Users cannot:
- Create new sequences
- Edit existing sequences
- View enrollments for a sequence
- Pause or activate sequences
- Enroll contacts into sequences
- See actual enrollment and open rate stats

## Solution Overview

### 1. Create Sequence Builder Component
A modal/sheet for creating and editing email sequences with:
- Name, description, trigger type inputs
- From email/name configuration
- Step builder (add/remove email steps with day delays)
- Subject and template selection for each step
- Save as draft or activate

### 2. Create Enrollment Modal Component
A dialog to enroll contacts into a sequence:
- Contact search/selection
- Preview of sequence steps
- Confirm enrollment button

### 3. Create Sequence Enrollments View Component  
A sheet to view all contacts enrolled in a sequence:
- List of enrolled contacts with their status
- Current step progress
- Option to pause/cancel individual enrollments

### 4. Wire Up All Dropdown Actions
Connect the existing dropdown menu items to their handlers:
- Edit Sequence: Opens SequenceBuilder with sequence data
- View Enrollments: Opens EnrollmentsSheet
- Pause/Activate: Calls useUpdateSequence mutation
- Duplicate: Creates a copy with "(Copy)" suffix

### 5. Calculate Real Stats
Query actual data for the stats cards:
- Enrolled count from sequence_enrollments
- Avg Open Rate from sequence_emails (opened_at / sent_at)

---

## Technical Implementation

### New Components to Create

**File: `src/components/sequences/SequenceBuilderSheet.tsx`**
- Sheet component with form for sequence editing
- Step builder with drag-and-drop reordering
- Uses useCreateSequence and useUpdateSequence hooks
- Includes template previews

**File: `src/components/sequences/EnrollContactModal.tsx`**
- Dialog to search and select contacts
- Uses useEnrollContact mutation
- Shows preview of selected sequence

**File: `src/components/sequences/SequenceEnrollmentsSheet.tsx`**
- Sheet showing all enrollments for a sequence
- Uses useSequenceEnrollments hook
- Displays contact info, current step, status
- Actions to pause/cancel enrollments

### Modify Existing Files

**File: `src/pages/Sequences.tsx`**
Changes needed:
1. Add state for selected sequence (for edit/view)
2. Add state for modals/sheets (builder, enrollments, enroll contact)
3. Wire up "Create Sequence" button to open builder sheet
4. Wire up dropdown menu items:
   - "Edit Sequence" -> open builder with sequence data
   - "View Enrollments" -> open enrollments sheet  
   - "Pause/Activate" -> call update mutation
   - "Duplicate" -> call create mutation with copy
5. Add "Enroll Contacts" action to dropdown
6. Query actual enrollment counts for stats

**File: `src/hooks/useSequences.ts`**
Add new hooks/queries:
- `useSequenceStats()` - aggregate stats for dashboard
- `useUnenrollContact()` - cancel an enrollment
- `usePauseEnrollment()` - pause an enrollment

### Stats Calculation

Query for enrolled count:
```typescript
const { data: enrollmentCount } = await supabase
  .from("sequence_enrollments")
  .select("id", { count: "exact" })
  .eq("status", "active");
```

Query for open rate:
```typescript
const { data: emailStats } = await supabase
  .from("sequence_emails")
  .select("opened_at, sent_at");
// Calculate: emails with opened_at / total sent
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/sequences/SequenceBuilderSheet.tsx` | Create | Create/edit sequences |
| `src/components/sequences/EnrollContactModal.tsx` | Create | Enroll contacts in sequences |
| `src/components/sequences/SequenceEnrollmentsSheet.tsx` | Create | View enrollments per sequence |
| `src/pages/Sequences.tsx` | Modify | Wire up all actions and stats |
| `src/hooks/useSequences.ts` | Modify | Add stats and enrollment management hooks |

---

## User Interface Flow

### Creating a Sequence
1. Click "Create Sequence" button
2. SequenceBuilderSheet opens with empty form
3. Fill in name, trigger type, from email
4. Add email steps (Day 0, Day 3, etc.) with subjects
5. Select templates for each step
6. Click "Save as Draft" or "Activate"

### Editing a Sequence
1. Click dropdown menu on sequence card
2. Select "Edit Sequence"
3. SequenceBuilderSheet opens with existing data
4. Make changes
5. Save

### Enrolling Contacts
1. Click dropdown menu on sequence card
2. Select "Enroll Contacts"
3. EnrollContactModal opens
4. Search and select contacts
5. Click "Enroll"
6. Contact is added to sequence_enrollments with next_email_at calculated

### Viewing Enrollments
1. Click dropdown menu on sequence card
2. Select "View Enrollments"
3. SequenceEnrollmentsSheet opens
4. See list of enrolled contacts with progress
5. Option to pause/cancel individual enrollments

### Pause/Activate Sequence
1. Click dropdown on sequence card
2. Click "Pause" (if active) or "Activate" (if draft/paused)
3. Sequence status updates immediately
4. Toast notification confirms action

---

## Expected Outcome
After implementation:
1. All buttons and menu items will be functional
2. Users can create and edit sequences with a visual builder
3. Users can enroll contacts into sequences
4. Users can view and manage enrollments
5. Dashboard stats show real data (enrolled count, open rates)
6. Sequences can be paused, activated, and duplicated

