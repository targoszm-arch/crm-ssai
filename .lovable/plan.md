
# Fix Visual Editor Content Being Deleted on Tab Switch

## Root Cause

The `TabsContent` components are **missing the `forceMount` prop**. Without it, Radix UI unmounts the inactive tab content, destroying the `contentEditable` div. When switching back:
1. A brand new empty div is created
2. But refs persist across renders, so `prevModeRef.current` still equals "visual"
3. `switchingToVisual = false` because the ref says we're already on visual
4. The sync logic doesn't run and the editor stays empty

## Solution

Add `forceMount` and conditional `hidden` attribute to both TabsContent elements. This keeps the DOM alive but visually hides inactive tabs.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/shared/RichTextComposer.tsx` | Add `forceMount` + `hidden` to TabsContent elements |
| `src/components/templates/EmailTemplateEditor.tsx` | Same fix |

---

## Technical Changes

### RichTextComposer.tsx (lines ~644-666)

**Before:**
```tsx
<TabsContent value="visual" className="mt-0">
  <div ref={editorRef} contentEditable .../>
</TabsContent>

<TabsContent value="html" className="mt-0">
  <textarea ... />
</TabsContent>
```

**After:**
```tsx
<TabsContent value="visual" className="mt-0" forceMount hidden={mode !== "visual"}>
  <div ref={editorRef} contentEditable .../>
</TabsContent>

<TabsContent value="html" className="mt-0" forceMount hidden={mode !== "html"}>
  <textarea ... />
</TabsContent>
```

### EmailTemplateEditor.tsx

Apply the same `forceMount` + `hidden` pattern to both TabsContent elements.

---

## Why This Fixes the Problem

1. **`forceMount`**: Keeps the `contentEditable` div in the DOM at all times
2. **`hidden={mode !== "visual"}`**: Hides the element visually when on another tab (uses the native HTML `hidden` attribute)
3. **Ref stability**: `editorRef.current` always points to the same DOM element
4. **Content preserved**: User's typed content stays in the DOM, no re-sync needed

---

## Verification

After fix:
1. Type content in Visual tab → stays
2. Switch to HTML tab → Visual div is hidden but preserved
3. Switch back to Visual → Content is still there (same DOM element)
4. External changes (template selection) still work correctly
