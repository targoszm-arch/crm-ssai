import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A page's primary actions, rendered in the top bar.
 *
 * They used to sit inside each page, which put "New deal" at the right-hand end
 * of a kanban board you had to scroll sideways to reach — the button existed
 * but you couldn't see it. The top bar is in the same place on every page, so
 * that is where they go.
 *
 * A portal rather than state: a page hands over a node on every render, and
 * storing that node in the provider's state would set state during render and
 * loop. The provider only ever holds the slot element.
 *
 *   <PageActions>
 *     <Button onClick={...}>New deal</Button>
 *   </PageActions>
 */

const SlotContext = createContext<HTMLElement | null>(null);
const SetSlotContext = createContext<(el: HTMLElement | null) => void>(() => {});

export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <SetSlotContext.Provider value={setSlot}>
      <SlotContext.Provider value={slot}>{children}</SlotContext.Provider>
    </SetSlotContext.Provider>
  );
}

/** Where the actions land. Rendered once, by the header. */
export function PageActionsSlot({ className }: { className?: string }) {
  const setSlot = useContext(SetSlotContext);
  return <div ref={setSlot} className={className} />;
}

/** What a page wraps its buttons in. Renders nothing outside the shell. */
export function PageActions({ children }: { children: ReactNode }) {
  const slot = useContext(SlotContext);
  if (!slot) return null;
  return createPortal(children, slot);
}
