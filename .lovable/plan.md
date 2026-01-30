
# Fix Visual Editor Not Displaying HTML Content

## Problem
When HTML is loaded into the editor (template selected, pasted, or initial value), the Visual mode shows empty content. Only HTML mode and Preview work. This is a regression from the cursor-jumping fix.

## Root Cause
The recent fix removed `dangerouslySetInnerHTML` to prevent cursor jumping, but this broke initial content rendering:

```tsx
// Current useEffect - has a bug
const lastValueRef = useRef(value);  // Initialized to current value

useEffect(() => {
  const isExternalChange = value !== lastValueRef.current;  // FALSE on mount!
  if (isExternalChange && !isFocusedRef.current) {
    editorRef.current.innerHTML = value;  // Never runs on initial mount
  }
  lastValueRef.current = value;
}, [value, mode]);
```

On initial mount:
- `lastValueRef.current` = `value` (both are the same)
- `isExternalChange` = `false`
- The `innerHTML = value` line never executes
- Editor stays empty

## Solution
Add a separate initialization effect that runs once on mount and whenever we switch to visual mode:

```tsx
const lastValueRef = useRef(value);
const hasInitializedRef = useRef(false);

// Initial content sync - runs on mount and mode switch to visual
useEffect(() => {
  if (editorRef.current && mode === "visual") {
    // Always set content on initial mount or when switching to visual mode
    if (!hasInitializedRef.current || editorRef.current.innerHTML !== value) {
      if (!isFocusedRef.current) {
        editorRef.current.innerHTML = value;
        hasInitializedRef.current = true;
      }
    }
  }
}, [mode]); // Only depends on mode for tab switching

// External value changes while editing
useEffect(() => {
  if (editorRef.current && mode === "visual" && hasInitializedRef.current) {
    const isExternalChange = value !== lastValueRef.current;
    if (isExternalChange && !isFocusedRef.current) {
      editorRef.current.innerHTML = value;
    }
    lastValueRef.current = value;
  }
}, [value, mode]);
```

## Files to Modify

| File | Change |
|------|--------|
| `src/components/shared/RichTextComposer.tsx` | Add initialization effect with `hasInitializedRef` |
| `src/components/templates/EmailTemplateEditor.tsx` | Same fix |

## Technical Details

### Fix for Both Editors

The key changes:
1. Add `hasInitializedRef` to track if initial content has been set
2. Split the useEffect into two:
   - **Initialization effect**: Sets content on mount and when switching to visual mode
   - **External update effect**: Only handles value changes after initialization
3. Ensure content is set even if user hasn't focused yet

### Simplified Single useEffect Approach

Actually, the simplest fix is to always set content when NOT focused, regardless of whether it's "external":

```tsx
useEffect(() => {
  if (editorRef.current && mode === "visual" && !isFocusedRef.current) {
    // Always sync when not focused - covers initial mount + external changes
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }
  lastValueRef.current = value;
}, [value, mode]);
```

This approach:
- Works on initial mount (not focused, innerHTML is empty, value has content)
- Works when selecting template (not focused after dialog closes)
- Works when switching from HTML mode to Visual mode
- Still protects cursor position while focused

## Verification

After fix:
1. Select a template with HTML - should appear in Visual mode immediately
2. Switch to HTML mode, paste content, switch back to Visual - should render
3. Type in Visual mode - cursor should not jump
4. Insert image/CTA - should work correctly
