
## Goals
1. Fix Inbox folder views so **Inbox / Sent / Drafts / Archive** actually show different emails (not “everything in Inbox”).
2. Fix the rich email editor so:
   - inserting an image/video reliably inserts into the editor,
   - the cursor does not jump / editor doesn’t lose focus,
   - inserted media goes exactly where the cursor was.

---

## What’s actually broken (root causes)

### A) “Mailbox not sorted” (UI bug, not primarily data)
- `Inbox.tsx` correctly passes `folder={currentFolder}` into `<EmailList />`.
- But `EmailList.tsx` **ignores that folder prop** when fetching emails:
  - It calls `useEmails({ accountId, linkedOnly, search })` and does **not** pass `folder`.
- Result: regardless of which folder you click in the sidebar, the list query returns the same dataset, making it look like “everything is in Inbox”.

### B) Sync logic has a Gmail API issue that can prevent proper folder detection (and reduce coverage)
In `supabase/functions/sync-emails/index.ts`:
- The list endpoint is called with:
  - `labelIds=INBOX`
  - `labelIds=SENT`
- Gmail’s `labelIds` filter behaves like an AND (message must match all listed labels). A message usually won’t be both Inbox and Sent at the same time.
- Even if you already have emails, this can cause inconsistent syncing and poor label coverage (drafts/archived etc).

### C) “Inserting images doesn’t work” / editor jumping & losing cursor
Both `RichTextComposer.tsx` and `EmailTemplateEditor.tsx` have this sync effect:
```ts
useEffect(() => {
  if (editorRef.current && mode === "visual") {
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }
}, [value, mode]);
```
This can break editing because:
- `contentEditable` HTML is frequently “normalized” by the browser.
- `innerHTML !== value` can be true even when content is effectively the same.
- That causes React to force-reset `innerHTML`, which:
  - blows away the cursor position,
  - can make the caret jump outside,
  - can make insertions appear to “do nothing” (they insert, then get overwritten immediately).

Also, the image upload flow currently:
- uploads file successfully (confirmed via network log: Storage upload returns 200),
- sets `imageUrl`,
- but requires a separate “Insert” action; if the cursor/selection isn’t preserved, insertion can end up at the wrong place or get overwritten by the effect above.

---

## Implementation Plan (what I will change)

### 1) Fix folder filtering end-to-end (Inbox / Sent / Drafts / Archive)
**Files:**
- `src/components/inbox/EmailList.tsx`
- `src/hooks/useEmails.ts`
- (optionally) `src/components/inbox/InboxSidebar.tsx` (only if folder names mismatch)

**Steps:**
1. Update `EmailList.tsx` so the `useEmails()` call includes:
   - `folder`
   - the `filters` prop
   - and its own local filter states (linked/unlinked/search)
2. Decide the “source of truth” for filtering:
   - Recommended: keep data querying in `useEmails(filters)` as much as possible, and only do minimal post-filtering in the component.
3. Ensure the `folder` passed matches the DB values (`inbox`, `sent`, `drafts`, `archive`).
4. Add a small debug indicator in the EmailList header (temporary) showing which folder and query filters are active, so we can confirm the UI is actually filtering.

**Expected result:**
- Clicking “Sent” shows only `emails.folder='sent'`.
- Clicking “Inbox” shows only `emails.folder='inbox'`.
- No more “everything is in inbox” feeling.

---

### 2) Fix Gmail sync so it fetches the right messages and assigns folders reliably
**File:**
- `supabase/functions/sync-emails/index.ts`

**Steps:**
1. Change Gmail list calls to avoid `labelIds=INBOX` AND `labelIds=SENT`.
2. Use one of these safer approaches:
   - Option A (recommended): Use query string:
     - `q="after:TIMESTAMP (in:inbox OR in:sent OR in:drafts)"`
     - and do not pass multiple `labelIds`.
   - Option B: Do separate list calls for INBOX and SENT and merge results.
3. Ensure folder assignment logic is correct order:
   - Draft detection should come before direction-based sent detection if you want drafts to be drafts.
   - Example:
     - if `labelIds.includes("DRAFT")` => folder `drafts`
     - else if outbound => folder `sent`
     - else if trash => folder `trash` (if you want it)
     - else folder `inbox`
4. Add logging in the edge function response counts by folder (temporary), to verify it’s assigning.

**Expected result:**
- Newly synced emails get correct `folder`.
- Drafts stop being misclassified.
- Sync results are more complete and consistent.

---

### 3) Fix editor cursor jumping + “insert image/video does nothing”
**Files:**
- `src/components/shared/RichTextComposer.tsx`
- `src/components/templates/EmailTemplateEditor.tsx`

**Core changes:**
1. Add an “isEditing” guard:
   - Track focus and active user typing using refs:
     - `isFocusedRef`
     - `isApplyingExternalUpdateRef`
   - Only run the `innerHTML = value` sync when:
     - editor is not focused OR user is not actively editing,
     - and the update is truly external (template load / reset / initial mount).
2. Replace naive `innerHTML !== value` compare with a safer approach:
   - Keep `lastAppliedValueRef`
   - Only apply external updates if `value` changed from outside and the editor is not focused.
3. Preserve selection for insert operations:
   - When opening Image/Video/CTA dialogs, store current selection range (like you already do for linking text).
   - When inserting, restore that selection before `execCommand("insertHTML", ...)`.
4. Improve image/video upload UX:
   - After upload completes, either:
     - auto-insert immediately at the saved cursor position, OR
     - keep “Insert” button but ensure selection restore + focus is correct so it inserts exactly where expected.

**Expected result:**
- Cursor stays where you put it.
- Typing is stable.
- Inserting images/videos reliably inserts into the editor content and remains there.

---

### 4) Quick safety checks (so we don’t regress)
1. Verify Storage upload is working (it is, per network logs).
2. Verify editor still supports:
   - link wrapping selected text,
   - clicking images to add a link,
   - CTA insertion.

---

## Validation / What you’ll test after I implement
1. Go to **/inbox**:
   - Click Inbox vs Sent vs Drafts and confirm the list changes (counts and items).
2. Click **Sync**:
   - Confirm newly synced outbound emails show in Sent.
3. Compose an email:
   - Place cursor mid-text, insert image, ensure it appears exactly there.
   - Keep typing after image, cursor should not jump outside editor.
4. Template editor:
   - Same tests in Sequence template editor.

---

## Notes / Known constraints
- Gmail folder concepts are label-based; “Archive” means “not in inbox” and may require additional label logic if you want a true archive view (we can implement that next once Inbox/Sent are correct).
- Many email clients don’t autoplay video; embedding video is often best as a thumbnail image with a link. We can improve this further after stability fixes.

---

## Deliverables (exact code areas I’ll change)
- Email folder filtering:
  - `src/components/inbox/EmailList.tsx` (pass folder/filters into useEmails)
  - `src/hooks/useEmails.ts` (support more filter fields at query level where possible)
- Gmail sync:
  - `supabase/functions/sync-emails/index.ts` (fix Gmail list query)
- Editor stability:
  - `src/components/shared/RichTextComposer.tsx` (focus/edit guard + selection restore)
  - `src/components/templates/EmailTemplateEditor.tsx` (same)

