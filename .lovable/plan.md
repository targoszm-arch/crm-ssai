

# Implementation Gaps Analysis and Fix Plan

## Gap 1: Emails Not Being Sorted Into Inbox/Sent Folders

### Current Issue
The `sync-emails` Edge Function inserts emails **without** setting the `folder` field. The database has a `folder` column with default `'inbox'`, but the sync doesn't differentiate based on direction (inbound vs outbound).

**Current code in `sync-emails/index.ts` (line 292-311):**
- Inserts emails without a `folder` field
- All emails get the default `'inbox'` value regardless of direction

### Fix
Update the `sync-emails` function to set the `folder` field based on:
- `direction === 'outbound'` → `folder: 'sent'`
- `direction === 'inbound'` → `folder: 'inbox'`
- Also check Gmail `labelIds` for DRAFT → `folder: 'drafts'`

---

## Gap 2: Folder Filter Not Passed to EmailList

### Current Issue
In `Inbox.tsx` (line 222), the `EmailList` component is rendered **without** the `folder`, `filters`, `selectedIds`, `onSelectionChange`, or `showCheckboxes` props:

```tsx
<EmailList 
  accounts={accounts || []} 
  selectedEmail={selectedItem?.type === "email" ? selectedItem.item : null} 
  onSelectEmail={handleSelectEmail} 
/>
```

The component accepts these props but they're not being passed.

### Fix
Update `Inbox.tsx` to pass all required props to `EmailList`:
- `folder={currentFolder}`
- `filters={filters}`
- `selectedIds={selectedEmails}`
- `onSelectionChange={setSelectedEmails}`
- `showCheckboxes={true}`

---

## Gap 3: Rich Text Composer Missing Image/Video/Attachment Embedding

### Current Issue
Both `RichTextComposer.tsx` and `EmailTemplateEditor.tsx` have toolbars with basic formatting (bold, italic, underline, lists, links) but are **missing**:
- Image embedding button and dialog
- Video embedding button and dialog  
- Attachment embedding/reference button

### Fix
Add to both components:

**Image Embedding:**
- Toolbar button with Image icon
- Dialog to insert image URL with alt text
- Insert `<img src="..." alt="..." />` into content

**Video Embedding:**
- Toolbar button with Video icon
- Dialog to insert video URL
- Auto-detect YouTube/Vimeo and create proper embed iframe
- Or insert `<video>` tag for direct URLs

**Attachment Reference:**
- Toolbar button with Paperclip icon
- Note: Actual file upload would require storage bucket setup
- For now, allow referencing URLs or placeholders

---

## Gap 4: EmailFilters Type Mismatch

### Current Issue
There are **two different** `EmailFilters` interfaces:
1. In `EmailList.tsx` (line 22-29) - has `labels: string[]` (required)
2. In `InboxFilters.tsx` (line 14-22) - has `labels?: string[]` (optional)

The `Inbox.tsx` uses the `InboxFilters` version and passes to `EmailList` which expects the `EmailList` version with required `labels`.

### Fix
Unify the `EmailFilters` interface - export from a single location (e.g., keep in `useEmails.ts`) and use consistently across all components.

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/sync-emails/index.ts` | Set `folder` field based on direction/labels |
| `src/pages/Inbox.tsx` | Pass folder, filters, selection props to EmailList |
| `src/components/shared/RichTextComposer.tsx` | Add image, video, attachment embedding |
| `src/components/templates/EmailTemplateEditor.tsx` | Add image, video embedding |
| `src/components/inbox/EmailList.tsx` | Fix EmailFilters interface to match |
| `src/hooks/useEmails.ts` | Export unified EmailFilters type |

---

## Implementation Details

### 1. Update sync-emails Function

```typescript
// Determine folder based on direction and labels
let folder = 'inbox';
if (direction === 'outbound') {
  folder = 'sent';
} else if (msgData.labelIds?.includes('DRAFT')) {
  folder = 'drafts';
}

// Insert with folder
const { data: inserted } = await supabase
  .from("emails")
  .insert({
    ...existingFields,
    folder,
  })
```

### 2. Update Inbox.tsx EmailList Props

```tsx
<EmailList 
  accounts={accounts || []} 
  selectedEmail={selectedItem?.type === "email" ? selectedItem.item : null} 
  onSelectEmail={handleSelectEmail}
  folder={currentFolder}
  filters={filters}
  selectedIds={selectedEmails}
  onSelectionChange={setSelectedEmails}
  showCheckboxes={true}
/>
```

### 3. Rich Text Composer Enhancements

Add new toolbar buttons and dialogs:

```tsx
// New state
const [imageDialogOpen, setImageDialogOpen] = useState(false);
const [imageUrl, setImageUrl] = useState("");
const [imageAlt, setImageAlt] = useState("");
const [videoDialogOpen, setVideoDialogOpen] = useState(false);
const [videoUrl, setVideoUrl] = useState("");

// Image insert handler
const handleInsertImage = () => {
  if (imageUrl) {
    const imgHtml = `<img src="${imageUrl}" alt="${imageAlt}" style="max-width: 100%;" />`;
    execCommand("insertHTML", imgHtml);
  }
  setImageDialogOpen(false);
  setImageUrl("");
  setImageAlt("");
};

// Video embed handler
const handleInsertVideo = () => {
  if (videoUrl) {
    let embedHtml = "";
    // YouTube detection
    const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (ytMatch) {
      embedHtml = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>`;
    } 
    // Vimeo detection
    else if (videoUrl.includes("vimeo.com")) {
      const vimeoId = videoUrl.split("/").pop();
      embedHtml = `<iframe src="https://player.vimeo.com/video/${vimeoId}" width="560" height="315" frameborder="0" allowfullscreen></iframe>`;
    }
    // Direct video URL
    else {
      embedHtml = `<video src="${videoUrl}" controls style="max-width: 100%;"></video>`;
    }
    execCommand("insertHTML", embedHtml);
  }
  setVideoDialogOpen(false);
  setVideoUrl("");
};

// Add toolbar buttons
<Button onClick={() => setImageDialogOpen(true)} title="Insert Image">
  <Image className={iconSize} />
</Button>
<Button onClick={() => setVideoDialogOpen(true)} title="Insert Video">
  <Video className={iconSize} />
</Button>
<Button onClick={() => /* attachment logic */} title="Insert Attachment">
  <Paperclip className={iconSize} />
</Button>
```

### 4. Unified EmailFilters Type

Export from `useEmails.ts`:

```typescript
export interface EmailFilters {
  accountId?: string;
  contactId?: string;
  companyId?: string;
  linkedOnly?: boolean;
  search?: string;
  folder?: string;
  followUpDays?: "0-3" | "4-7" | "8-30";
  labels?: string[];
  isUnread?: boolean;
  linkedWithDeal?: boolean | null;
  isTracked?: boolean;
  hasAttachments?: boolean;
  fromContact?: boolean;
}
```

Then import this type in both `EmailList.tsx` and `InboxFilters.tsx` instead of defining locally.

---

## Verification Checklist

After implementation, verify:
- [ ] Synced emails appear in correct folders (inbox for inbound, sent for outbound)
- [ ] Folder counts update in sidebar
- [ ] Clicking folders shows filtered emails
- [ ] Bulk selection checkboxes appear and work
- [ ] Filters apply correctly to email list
- [ ] Image embedding works in composer (URL input + preview)
- [ ] Video embedding works (YouTube/Vimeo/direct)
- [ ] Same rich media features work in EmailTemplateEditor

