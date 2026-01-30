

# Create Shareable Rich Text Composer with Template Integration

## Problem Summary

Currently, there are three different email/message composition interfaces in the codebase:
1. **EmailThread.tsx** - Simple contentEditable for email replies (no rich formatting toolbar)
2. **LinkedInMessageView.tsx** - Basic textarea for draft replies (plain text only)
3. **ComposeEmail.tsx** - Simple textarea for new emails (no rich text)

Meanwhile, **EmailTemplateEditor.tsx** has a full-featured rich text editor with:
- Visual/HTML toggle
- Formatting toolbar (bold, italic, underline, headers, lists)
- Link insertion
- Merge tag support

The goal is to create a single **RichTextComposer** component that combines the template editor's rich text capabilities with template selection, and use it across all composition contexts.

---

## Solution Overview

### Create a Reusable RichTextComposer Component

A new component that provides:
- Rich text editing (formatting toolbar)
- Template selection button (opens TemplateListModal)
- Auto-populate content when template is selected
- AI draft generation integration
- Compact mode for inline replies vs. full mode for compose dialogs
- Merge tag support

### Update Existing Components

Replace the basic contentEditable/textarea in:
- `EmailThread.tsx` - Use RichTextComposer for replies
- `LinkedInMessageView.tsx` - Use RichTextComposer for draft generation
- `ComposeEmail.tsx` - Use RichTextComposer for new emails

---

## Technical Implementation

### New Component: `src/components/shared/RichTextComposer.tsx`

A self-contained component with the following props:

```typescript
interface RichTextComposerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  compact?: boolean; // Smaller toolbar for inline use
  showTemplates?: boolean; // Show "Use Template" button
  showMergeTags?: boolean; // Show merge tag dropdown
  onTemplateSelect?: (template: EmailTemplate) => void;
  className?: string;
}
```

**Features:**
- Formatting toolbar (Bold, Italic, Underline, Links, Lists)
- "Use Template" button that opens TemplateListModal in selection mode
- When template selected: populates content and notifies parent
- Merge tag insertion dropdown
- Visual/HTML mode toggle (optional, can be hidden in compact mode)

### Component Structure

```
RichTextComposer
├── Toolbar
│   ├── Format buttons (Bold, Italic, Underline)
│   ├── Separator
│   ├── Header buttons (H1, H2)
│   ├── List buttons (UL, OL)
│   ├── Separator
│   ├── Link button
│   ├── Separator
│   ├── Template button → Opens TemplateListModal
│   └── Merge Tags dropdown
├── Editor Area (contentEditable or textarea for HTML mode)
└── Optional: Mode toggle (Visual/HTML)
```

### Updates to Existing Files

**File: `src/components/inbox/EmailThread.tsx`**
- Replace the basic contentEditable with RichTextComposer
- Pass the reply body value and onChange handler
- Enable templates and merge tags
- Keep existing AI suggest functionality alongside

**File: `src/components/inbox/LinkedInMessageView.tsx`**
- Replace the Textarea with RichTextComposer
- Enable templates for pre-written responses
- Merge tags still work (contact info)

**File: `src/components/inbox/ComposeEmail.tsx`**
- Replace the Textarea with RichTextComposer
- Enable templates for quick email composition
- Full formatting toolbar visible

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/shared/RichTextComposer.tsx` | Create | Shareable rich text editor with template integration |
| `src/components/inbox/EmailThread.tsx` | Modify | Use RichTextComposer for replies |
| `src/components/inbox/LinkedInMessageView.tsx` | Modify | Use RichTextComposer for drafts |
| `src/components/inbox/ComposeEmail.tsx` | Modify | Use RichTextComposer for new emails |

---

## User Experience

### Using Templates in Email Reply
1. User clicks "Reply" on an email
2. RichTextComposer appears with formatting toolbar
3. User clicks "Templates" button in toolbar
4. TemplateListModal opens in selection mode
5. User selects a template (e.g., "Meeting Follow-up")
6. Template content populates the composer
7. User can edit, add formatting, insert merge tags
8. Click "Send" - email sent with formatted HTML

### Using Templates in LinkedIn Draft
1. User views a LinkedIn message
2. Clicks "AI Draft" or manually starts typing
3. Can click "Templates" to use a pre-written response
4. Formats text as needed
5. Copies formatted text to paste in LinkedIn

### Using Templates in New Email
1. User clicks "Compose" button
2. Full RichTextComposer appears with all features
3. Can start with a template or write from scratch
4. Full formatting toolbar available

---

## Component Reuse

The new RichTextComposer will be the single source of truth for:
- Rich text editing
- Template selection
- Merge tag insertion
- Formatting controls

This replaces duplicated code across three files and ensures consistent behavior and styling.

---

## Implementation Details

### RichTextComposer Core Logic

Based on the existing EmailTemplateEditor, but adapted for composition:

```typescript
// Key features from EmailTemplateEditor:
- execCommand for formatting (bold, italic, etc.)
- contentEditable for WYSIWYG editing
- Link insertion dialog
- Merge tag dropdown

// New additions:
- Template selection button + modal integration
- Compact mode with smaller toolbar
- onTemplateSelect callback
- Better styling for inline use
```

### Template Selection Flow

```typescript
const [templateModalOpen, setTemplateModalOpen] = useState(false);

const handleTemplateSelect = (template: EmailTemplate) => {
  // Set the editor content to template body
  if (editorRef.current) {
    editorRef.current.innerHTML = template.body_html || '';
  }
  onChange(template.body_html || '');
  
  // Notify parent (for subject line updates, etc.)
  onTemplateSelect?.(template);
  
  setTemplateModalOpen(false);
};
```

---

## Expected Outcome

After implementation:
1. All email/message composition uses consistent rich text editing
2. Templates are accessible from any composition context
3. Formatting is preserved in sent emails
4. Merge tags work across all contexts
5. Reduced code duplication
6. Better user experience with familiar editing controls

