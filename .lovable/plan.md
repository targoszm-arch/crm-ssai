
# Fix Visual Editor Content Being Deleted on Tab Switch

## Problem Identified

When switching from Visual to HTML mode, the Visual editor content gets deleted. This is happening because:

1. **Browser HTML normalization mismatch**: The contentEditable div's `innerHTML` gets normalized by the browser (whitespace changes, tag restructuring), so `editorRef.current.innerHTML !== safeHtml` returns `true` even when the content is logically the same
2. **Race condition on blur + mode change**: When clicking the HTML tab, blur fires first (setting `isFocusedRef = false`), then mode changes - the useEffect might re-run and overwrite content incorrectly
3. **Non-greedy regex issue**: The regex `([\s\S]*?)` is non-greedy and may fail to capture all body content in certain HTML structures

---

## Solution

### 1. Only sync when switching TO visual mode, not while in visual mode

Track the previous mode and only update innerHTML when switching from HTML to Visual:

```typescript
const prevModeRef = useRef(mode);

useEffect(() => {
  const switchingToVisual = mode === "visual" && prevModeRef.current !== "visual";
  
  if (editorRef.current && mode === "visual") {
    // Only set innerHTML when:
    // 1. Switching TO visual mode (from HTML), OR
    // 2. On initial mount (innerHTML is empty)
    const shouldInitialize = switchingToVisual || editorRef.current.innerHTML === "";
    
    if (shouldInitialize && !isFocusedRef.current) {
      const safeHtml = extractBodyContent(value);
      editorRef.current.innerHTML = safeHtml;
    }
  }
  
  prevModeRef.current = mode;
  lastValueRef.current = value;
}, [value, mode]);
```

### 2. Fix the regex to be greedy (capture all body content)

Change from non-greedy `*?` to greedy `*`:

```typescript
// Before (non-greedy - might miss content)
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

// After (greedy - captures all content between body tags)
const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
```

### 3. Handle external value changes separately

For cases where the value changes externally (template selection) while in visual mode:

```typescript
useEffect(() => {
  // Handle external value changes (template selection, reset, etc.)
  const isExternalChange = value !== lastValueRef.current;
  const switchingToVisual = mode === "visual" && prevModeRef.current !== "visual";
  
  if (editorRef.current && mode === "visual") {
    if ((switchingToVisual || isExternalChange || editorRef.current.innerHTML === "") 
        && !isFocusedRef.current) {
      const safeHtml = extractBodyContent(value);
      editorRef.current.innerHTML = safeHtml;
    }
  }
  
  prevModeRef.current = mode;
  lastValueRef.current = value;
}, [value, mode]);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/templates/EmailTemplateEditor.tsx` | Add `prevModeRef`, update sync logic, fix regex |
| `src/components/shared/RichTextComposer.tsx` | Same fixes for consistency |

---

## Technical Details

### Complete Updated useEffect

```typescript
const prevModeRef = useRef(mode);

// Extract body content - fixed with greedy regex
const extractBodyContent = (html: string): string => {
  if (/<html[\s>]/i.test(html) || /<!DOCTYPE/i.test(html)) {
    // Greedy match to capture ALL body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      return bodyMatch[1].trim();
    }
    const htmlMatch = html.match(/<html[^>]*>([\s\S]*)<\/html>/i);
    if (htmlMatch) {
      const content = htmlMatch[1].replace(/<head[\s\S]*?<\/head>/gi, '').trim();
      return content;
    }
  }
  return html;
};

// Sync content to visual editor
useEffect(() => {
  const switchingToVisual = mode === "visual" && prevModeRef.current !== "visual";
  const isExternalChange = value !== lastValueRef.current;
  
  if (editorRef.current && mode === "visual") {
    // Update innerHTML when:
    // 1. Switching from HTML to Visual mode
    // 2. External value change (template selection) while not focused
    // 3. Initial mount (innerHTML is empty)
    const isEmpty = editorRef.current.innerHTML === "";
    const shouldUpdate = (switchingToVisual || isExternalChange || isEmpty) && !isFocusedRef.current;
    
    if (shouldUpdate) {
      const safeHtml = extractBodyContent(value);
      editorRef.current.innerHTML = safeHtml;
    }
  }
  
  prevModeRef.current = mode;
  lastValueRef.current = value;
}, [value, mode]);
```

---

## Why This Fixes the Issue

1. **No more innerHTML comparison**: We removed `editorRef.current.innerHTML !== safeHtml` which was causing false positives due to browser normalization
2. **Mode tracking**: By tracking `prevModeRef`, we only re-initialize content when actually switching TO visual mode
3. **Greedy regex**: Ensures all body content is captured, even in complex HTML structures
4. **Preserved typing stability**: The `!isFocusedRef.current` check still protects cursor position while editing

---

## Verification

After fix:
1. Type in Visual mode → content stays
2. Switch to HTML tab → Visual content preserved in state
3. Switch back to Visual → content re-renders correctly
4. Paste full HTML in HTML mode → Visual shows extracted body
5. Edit in Visual → switch tabs repeatedly → no content loss
