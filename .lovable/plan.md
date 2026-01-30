
# Enhanced Rich Text Editor with Gmail-like Features

## What You Asked For

1. **Click embedded image → Add trackable link** - Like Gmail, click an image to attach a link
2. **Select text → Wrap with link** - When text is selected, clicking link button wraps it
3. **CTA Buttons** - Insert styled call-to-action buttons with links
4. **Direct file upload** - Upload images/videos from computer, not just URL

---

## Implementation Plan

### 1. Selection-Aware Link Insertion

**Current Behavior**: Link button always opens dialog asking for URL + text, then inserts at cursor

**New Behavior**:
- If text is selected: Save selection, open dialog with only URL field, wrap selection in link
- If no selection: Open dialog asking for URL + text (current behavior)

```text
User Flow:
+------------------+        +------------------+
| Select text in   |  --->  | Click Link       |
| editor           |        | button           |
+------------------+        +------------------+
                                    |
                                    v
                    +---------------------------+
                    | Dialog shows:             |
                    | - Selected text preview   |
                    | - URL input only          |
                    | - Track clicks checkbox   |
                    +---------------------------+
                                    |
                                    v
                    +---------------------------+
                    | Selected text wrapped in  |
                    | <a href="url">text</a>    |
                    +---------------------------+
```

### 2. Clickable Images with Link Support

**Current Behavior**: Images are inserted as standalone `<img>` tags

**New Behavior**:
- Click on image in editor → Show floating toolbar with "Add Link" option
- Insert images wrapped in clickable `<a>` tags when link is provided
- Track clicks when link is used

```text
+---------------------------+
| Floating Image Toolbar    |
| [Link] [Remove] [Resize]  |
+---------------------------+
         |
         v
+---------------------------+
| Link Dialog:              |
| - URL input               |
| - Open in new tab toggle  |
| - Track clicks toggle     |
+---------------------------+
```

### 3. CTA Button Insertion

**New Feature**: Add "Button" option to toolbar

```text
+---------------------------+
| Insert CTA Button Dialog  |
|                           |
| Button Text: [Get Started]|
| Link URL: [https://...]   |
| Style: [Primary v]        |
|   - Primary (blue)        |
|   - Secondary (gray)      |
|   - Success (green)       |
| Track clicks: [x]         |
+---------------------------+
```

Generated HTML:
```html
<a href="https://..." style="display: inline-block; padding: 12px 24px; 
   background-color: #3b82f6; color: white; text-decoration: none; 
   border-radius: 6px; font-weight: 500;">
  Get Started
</a>
```

### 4. Direct File Upload for Images/Videos

Replace URL-only input with tabbed interface:

```text
+---------------------------+
| Insert Image              |
| [Upload] [URL]            |
+---------------------------+
| Tab: Upload               |
| +---------------------+   |
| | Drop image here     |   |
| | or click to browse  |   |
| +---------------------+   |
| Max size: 10MB            |
+---------------------------+
```

**Storage**: Uses Supabase Storage bucket `email-attachments`

---

## Technical Changes

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/shared/RichTextComposer.tsx` | Add selection handling, image click events, CTA button dialog, file upload |
| `src/components/templates/EmailTemplateEditor.tsx` | Same enhancements |
| `supabase/migrations/NEW.sql` | Create storage bucket with policies |

### Key Technical Implementation

**1. Selection Detection**
```typescript
const [savedSelection, setSavedSelection] = useState<Range | null>(null);
const [hasSelection, setHasSelection] = useState(false);

const handleLinkButtonClick = () => {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
    const range = selection.getRangeAt(0);
    setSavedSelection(range.cloneRange());
    setLinkText(selection.toString());
    setHasSelection(true);
  } else {
    setHasSelection(false);
  }
  setLinkDialogOpen(true);
};

const handleInsertLink = () => {
  if (hasSelection && savedSelection) {
    // Restore selection and wrap in link
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(savedSelection);
    document.execCommand('createLink', false, linkUrl);
  } else {
    // Insert new link at cursor
    execCommand("insertHTML", `<a href="${linkUrl}">${linkText}</a>`);
  }
};
```

**2. Image Click Detection**
```typescript
const handleEditorClick = (e: React.MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'IMG') {
    setSelectedImage(target as HTMLImageElement);
    setImageLinkDialogOpen(true);
  }
};

const handleAddLinkToImage = () => {
  if (selectedImage && imageLinkUrl) {
    const link = document.createElement('a');
    link.href = imageLinkUrl;
    link.target = '_blank';
    selectedImage.parentNode?.insertBefore(link, selectedImage);
    link.appendChild(selectedImage);
  }
};
```

**3. CTA Button Generation**
```typescript
const ctaStyles = {
  primary: 'background-color: #3b82f6; color: white;',
  secondary: 'background-color: #6b7280; color: white;',
  success: 'background-color: #10b981; color: white;',
  outline: 'background-color: transparent; color: #3b82f6; border: 2px solid #3b82f6;',
};

const handleInsertCTA = () => {
  const style = ctaStyles[ctaButtonStyle];
  const buttonHtml = `<a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; ${style} text-decoration: none; border-radius: 6px; font-weight: 500; margin: 8px 0;">${ctaText}</a>`;
  execCommand("insertHTML", buttonHtml);
};
```

**4. Storage Bucket Creation**
```sql
-- Create bucket for email attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('email-attachments', 'email-attachments', true, 10485760);

-- Public read access for email rendering
CREATE POLICY "Public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'email-attachments');

-- Authenticated upload
CREATE POLICY "Auth upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'email-attachments' AND auth.role() = 'authenticated');
```

**5. File Upload Handler**
```typescript
const handleFileUpload = async (file: File) => {
  const fileName = `${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from('email-attachments')
    .upload(fileName, file);

  if (data) {
    const { data: urlData } = supabase.storage
      .from('email-attachments')
      .getPublicUrl(data.path);
    return urlData.publicUrl;
  }
  return null;
};
```

---

## New Toolbar Buttons

Current toolbar:
```
[B] [I] [U] | [H1] [H2] | [•] [1.] | [Link] [Image] [Video] [📎] | [Templates] [Merge Tags]
```

Updated toolbar:
```
[B] [I] [U] | [H1] [H2] | [•] [1.] | [Link] [Image] [Video] [📎] [CTA Button] | [Templates] [Merge Tags]
```

---

## User Experience Improvements

1. **Link Dialog adapts to context**:
   - Text selected → Shows "Link selected text" with preview
   - No selection → Shows "Insert new link" with text field

2. **Image click shows floating menu**:
   - Options: Add Link, Remove, Resize

3. **CTA Button preview**:
   - Live preview of button style in dialog before inserting

4. **Drag and drop images**:
   - Drop zone appears when dragging files over editor
   - Auto-uploads and inserts

---

## Verification Checklist

After implementation:
- [ ] Select text, click Link → Only URL field shown, text is wrapped
- [ ] Click on embedded image → Link dialog appears, image becomes clickable
- [ ] Insert CTA button → Styled button appears in editor
- [ ] Upload image file → Uploads to storage, inserts in editor
- [ ] Same features work in EmailTemplateEditor (sequence templates)
