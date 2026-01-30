
Goal: In the LinkedIn inbox detail panel, keep the “Reply” action visible inline (fixed at the bottom of the panel) so you never have to scroll through a long LinkedIn message to find it—matching the behavior we already implemented for EmailThread.

What’s happening now (root cause)
- LinkedInMessageView currently lets the “Message Body” section scroll, but the overall layout is missing the same “overflow-hidden + min-h-0 + fixed header/footer” structure we used for EmailThread.
- In certain height/overflow combinations (especially inside nested flex containers), the middle section can grow and push the footer out of view, making you scroll to reach the reply action.

Implementation plan (no behavior changes besides layout)
1) Update LinkedInMessageView layout to use the same “email-client” flex pattern
- File: src/components/inbox/LinkedInMessageView.tsx
- Change the root wrapper from:
  - className="flex flex-col h-full"
  to:
  - className="flex flex-col h-full overflow-hidden"

2) Make header and “Link to contact” area fixed (non-scrolling)
- Mark both as fixed-size flex items:
  - Add flex-shrink-0 to the Header container
  - Add flex-shrink-0 to the “Link to Contact” container
- This ensures these top sections never scroll away.

3) Make only the message body scrollable (middle pane)
- Update the Message Body container to:
  - className="flex-1 min-h-0 overflow-auto p-4"
- The min-h-0 is critical in nested flex layouts to allow the scroll container to actually shrink and scroll instead of expanding.

4) Make the reply action/footer fixed at the bottom (always visible)
- Replace the current “Separator + Footer” structure with a single fixed footer container:
  - className="flex-shrink-0 border-t bg-muted/30 p-4"
- Inside it, keep the same “Reply in LinkedIn” button (since we cannot programmatically send LinkedIn replies from the app unless we build a separate integration path).
- Ensure the button is large and always present (like the mailbox Reply bar):
  - Make the button full-width to match the email view’s affordance.

5) Visual/UI verification (what you should see after)
- When you open a LinkedIn message:
  - Header stays visible
  - Link-to-contact row stays visible
  - The message content scrolls independently
  - The bottom “Reply in LinkedIn” action is always visible without scrolling

6) Edge cases to test
- Very long LinkedIn message_text (thousands of lines)
- Small laptop viewport height
- Mobile viewport widths
- Switching between Email and LinkedIn tabs quickly
- Selecting different LinkedIn messages repeatedly (layout should remain stable)

Files to change
- src/components/inbox/LinkedInMessageView.tsx
  - Apply the fixed header + scrollable middle + fixed footer layout pattern (same as EmailThread)

Notes / constraints
- This fix is strictly the layout/UX issue: the reply action is always accessible.
- Actual “send LinkedIn reply from inside the app” is a separate feature and would require a dedicated sending mechanism (LinkedIn doesn’t provide a simple public API for personal inbox messaging). For now, the fixed footer will provide an always-visible reply path via “Open/Reply in LinkedIn”.

Acceptance criteria
- On /inbox → LinkedIn tab → open any message: the bottom reply button is visible immediately, and remains visible while scrolling the message content.
