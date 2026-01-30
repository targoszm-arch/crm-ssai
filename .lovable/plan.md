

# Fix Visual Editor Showing Empty When Full HTML Is Pasted

## Problem Identified

When pasting **full HTML documents** (containing `<!DOCTYPE>`, `<html>`, `<head>`, `<body>` tags) into the HTML tab, switching to the Visual tab shows empty content.

**Why this happens**: The Visual mode uses a `contentEditable` `<div>`. When you set its `innerHTML` to a full HTML document with `<html>`, `<head>`, `<body>` tags, **browsers sanitize/strip those invalid nested elements**. A `<div>` cannot contain document-level elements, so the browser removes them - often leaving the content empty or garbled.

```text
Full HTML pasted:
<!DOCTYPE html>
<html>
  <head><style>...</style></head>
  <body>
    <p>Hello World</p>
  </body>
</html>

After browser sanitizes for contentEditable <div>:
<p>Hello World</p>   ← Only body content survives (sometimes even this is lost)
```

---

## Solution

**Sanitize the HTML before rendering in Visual mode** by extracting only the `<body>` content when full HTML documents are detected.

### Implementation Approach

Add a helper function that:
1. Detects if the HTML contains `<html>` or `<body>` tags
2. If yes, extracts only the content inside `<body>...</body>`
3. If no, uses the HTML as-is

```typescript
// Extract body content from full HTML documents for safe rendering
const extractBodyContent = (html: string): string => {
  // Check if this looks like a full HTML document
  if (/<html[\s>]/i.test(html) || /<!DOCTYPE/i.test(html)) {
    // Extract body content using regex
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      return bodyMatch[1].trim();
    }
  }
  return html;
};
```

### Where to Apply

In the `useEffect` that syncs content to the Visual editor:

```typescript
useEffect(() => {
  if (editorRef.current && mode === "visual" && !isFocusedRef.current) {
    // Extract body content if full HTML document was pasted
    const safeHtml = extractBodyContent(value);
    if (editorRef.current.innerHTML !== safeHtml) {
      editorRef.current.innerHTML = safeHtml;
    }
  }
  lastValueRef.current = value;
}, [value, mode]);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/templates/EmailTemplateEditor.tsx` | Add `extractBodyContent` helper, use it in visual mode sync |
| `src/components/shared/RichTextComposer.tsx` | Same fix for consistency |

---

## Technical Details

### Helper Function

```typescript
// Extract body content from full HTML documents for safe rendering in contentEditable
const extractBodyContent = (html: string): string => {
  // Check if this looks like a full HTML document
  if (/<html[\s>]/i.test(html) || /<!DOCTYPE/i.test(html)) {
    // Try to extract body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      return bodyMatch[1].trim();
    }
    // If no body tag but has html tag, try to extract content after head
    const htmlMatch = html.match(/<html[^>]*>([\s\S]*)<\/html>/i);
    if (htmlMatch) {
      // Remove head section and return the rest
      const content = htmlMatch[1].replace(/<head[\s\S]*?<\/head>/gi, '').trim();
      return content;
    }
  }
  return html;
};
```

### Updated useEffect

```typescript
useEffect(() => {
  if (editorRef.current && mode === "visual" && !isFocusedRef.current) {
    // Extract body content if full HTML document was pasted
    const safeHtml = extractBodyContent(value);
    if (editorRef.current.innerHTML !== safeHtml) {
      editorRef.current.innerHTML = safeHtml;
    }
  }
  lastValueRef.current = value;
}, [value, mode]);
```

---

## Important Notes

1. **The full HTML is preserved** in the `value` state (what gets saved to the database)
2. **Only the Visual rendering** is sanitized - the HTML tab still shows the full document
3. **Preview panel** also needs the same sanitization since it uses `dangerouslySetInnerHTML`

### Preview Panel Fix

```tsx
{/* Preview Panel */}
<div className="mt-4 border-t pt-4">
  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
    <Eye className="h-4 w-4" />
    Preview
  </div>
  <div
    className="p-4 border rounded-md bg-white ..."
    dangerouslySetInnerHTML={{ __html: extractBodyContent(value) }}
  />
</div>
```

---

## Verification

After fix:
1. Open template editor
2. Switch to HTML tab
3. Paste full HTML document with `<!DOCTYPE>`, `<html>`, `<body>` tags
4. Switch to Visual tab → **should now show the body content correctly**
5. Preview should also render the content
6. Regular HTML fragments (without document tags) should continue working normally

