

# Email Templates with Rich Text and HTML Editing

## Overview

This plan adds a complete email template management system to the Sequences page, allowing users to:
- Create and edit email templates with a rich text editor
- Switch between visual (rich text) and HTML code editing modes
- Save templates to the database for reuse
- Select saved templates when building sequence steps

---

## What Will Be Built

### 1. Template Management UI
A new "Templates" section accessible from the Sequences page with:
- List of all saved templates with preview
- Create, edit, duplicate, and delete templates
- Search/filter templates by name

### 2. Rich Text Editor Component
A custom editor supporting:
- Bold, italic, underline formatting
- Links and images
- Bullet and numbered lists
- Headers (H1, H2, H3)
- Toggle between Rich Text and HTML code view
- Live preview

### 3. Template Editor Modal
A full-featured editing experience with:
- Template name and category
- Subject line field
- Dual-mode editor (Visual / HTML)
- Merge tags for personalization (e.g., `{{first_name}}`)
- Save as new or update existing

---

## User Experience Flow

### Creating a Template
1. Navigate to Sequences page
2. Click "Templates" tab or button
3. Click "New Template"
4. Enter template name (e.g., "Welcome Email")
5. Write subject line
6. Use rich text editor to design the email body
7. Toggle to "HTML" mode to fine-tune code if needed
8. Click "Save Template"

### Using a Template in a Sequence
1. Open Sequence Builder
2. Add a step
3. Select template from dropdown (now shows saved templates)
4. Subject auto-fills from template (can override)
5. Template body is used when sending

---

## Technical Changes

### Database

**New table: `email_templates`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Template name |
| category | text | Category (welcome, follow_up, etc.) |
| subject | text | Default subject line |
| body_html | text | HTML content |
| body_text | text | Plain text version |
| is_default | boolean | System template flag |
| created_at | timestamp | Creation date |
| updated_at | timestamp | Last modified |

RLS policies: Allow authenticated users full access

### New Components

**`src/components/templates/EmailTemplateEditor.tsx`**
- Rich text editor with formatting toolbar
- HTML code editor toggle (uses contenteditable + textarea for code)
- Merge tag inserter
- Live preview pane

**`src/components/templates/TemplateListModal.tsx`**
- Grid/list view of all templates
- Quick preview on hover
- Actions: Edit, Duplicate, Delete

**`src/components/templates/EditTemplateSheet.tsx`**
- Full editing sheet for template details
- Name, category, subject fields
- Embeds EmailTemplateEditor
- Save/Cancel actions

### Modified Components

**`src/pages/Sequences.tsx`**
- Add "Templates" button/tab
- Open TemplateListModal on click

**`src/components/sequences/SequenceBuilderSheet.tsx`**
- Template dropdown now queries `email_templates` table
- Shows template preview when selected
- Option to "Edit Template" inline

### New Hook

**`src/hooks/useEmailTemplates.ts`**
```typescript
// CRUD operations for email templates
useEmailTemplates() - fetch all templates
useEmailTemplate(id) - fetch single template
useCreateTemplate() - create new
useUpdateTemplate() - update existing
useDeleteTemplate() - delete template
```

### Edge Function Update

**`supabase/functions/process-sequences/index.ts`**
- Remove hardcoded templates
- Query `email_templates` table for template content
- Fallback to basic content if template not found

---

## Rich Text Editor Implementation

The editor uses native browser `contentEditable` (similar to existing EmailThread.tsx) with a custom toolbar. This approach:
- Requires no additional dependencies
- Works well for email HTML
- Matches existing patterns in the codebase

**Toolbar Features:**
- Bold (Ctrl+B)
- Italic (Ctrl+I)
- Underline (Ctrl+U)
- Link insert
- Bullet list
- Numbered list
- Header formatting
- Merge tag dropdown

**HTML Mode:**
- Textarea with monospace font
- Syntax highlighting optional
- Validates HTML on save

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/[timestamp].sql` | Create | Add email_templates table |
| `src/hooks/useEmailTemplates.ts` | Create | Template CRUD hooks |
| `src/components/templates/EmailTemplateEditor.tsx` | Create | Rich text/HTML editor |
| `src/components/templates/TemplateListModal.tsx` | Create | Template library view |
| `src/components/templates/EditTemplateSheet.tsx` | Create | Template editing sheet |
| `src/pages/Sequences.tsx` | Modify | Add Templates button |
| `src/components/sequences/SequenceBuilderSheet.tsx` | Modify | Use saved templates |
| `supabase/functions/process-sequences/index.ts` | Modify | Load templates from DB |

---

## Seed Data

Pre-populate with useful starter templates:
- Welcome Email
- Follow-up
- Value Proposition
- Case Study
- Special Offer
- Meeting Request
- Thank You

---

## Merge Tags Support

The following merge tags will be supported:
- `{{first_name}}` - Contact's first name
- `{{last_name}}` - Contact's last name
- `{{email}}` - Contact's email
- `{{company}}` - Contact's company name

The process-sequences edge function already handles these replacements.

