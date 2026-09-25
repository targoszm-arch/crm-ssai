import { useEffect, useMemo, useRef, useState } from "react";
import type { CustomCellEditorProps } from "ag-grid-react";
import type { SuppressKeyboardEventParams } from "ag-grid-community";
import { cn } from "@/lib/utils";

/**
 * Let Enter reach the editor while it is open. The grid otherwise takes Enter
 * itself and ends the edit with the old value before the list can pick the
 * highlighted option. Set as the column's suppressKeyboardEvent.
 */
export const listEditorKeys = (p: SuppressKeyboardEventParams) => p.editing && p.event.key === "Enter";

export interface ListGroup {
  label?: string;
  options: { value: string; label: string }[];
}

interface Props extends CustomCellEditorProps<unknown, string | null> {
  groups: ListGroup[];
  /** Label for the "nothing" choice, stored as null. Omit to not offer one. */
  emptyLabel?: string;
}

/**
 * A pick-list editor that is open the moment the cell is clicked.
 *
 * The grid's own select editor opens its list only when editing starts from
 * the keyboard; started by a mouse it shows a closed select, so choosing an
 * accounting category took a double-click to edit, a click to open and a
 * click to choose — and a double-click that registered as two single clicks
 * did nothing. With `singleClickEdit` this is one click to open, one to pick.
 * Typing filters the list; Enter takes the first match, Escape cancels.
 */
export function ListCellEditor({ groups, emptyLabel, value, onValueChange, stopEditing }: Props) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  // Stop after the new value has reached the grid, not in the same tick —
  // otherwise the grid reads the value from before the click.
  useEffect(() => { if (picked) stopEditing(); }, [picked, stopEditing]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map(g => ({ ...g, options: g.options.filter(o => o.label.toLowerCase().includes(q)) }))
      .filter(g => g.options.length > 0);
  }, [groups, query]);

  const choose = (v: string | null) => { onValueChange(v); setPicked(true); };
  const first = filtered.flatMap(g => g.options)[0];

  return (
    <div className="flex w-[300px] flex-col rounded-md border bg-popover text-popover-foreground shadow-lg">
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && first) { e.preventDefault(); e.stopPropagation(); choose(first.value); }
          if (e.key === "Escape") stopEditing(true);
        }}
        placeholder="Type to filter…"
        className="border-b bg-transparent px-3 py-2 text-sm outline-none"
      />
      <div className="max-h-[360px] overflow-y-auto py-1 text-sm">
        {emptyLabel && !query && (
          <button type="button" onClick={() => choose(null)}
            className={cn("block w-full px-3 py-1.5 text-left text-muted-foreground hover:bg-accent",
              !value && "bg-accent/60")}>
            {emptyLabel}
          </button>
        )}
        {filtered.map((g, i) => (
          <div key={g.label ?? i}>
            {g.label && (
              <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {g.label}
              </div>
            )}
            {g.options.map(o => (
              <button key={o.value} type="button" onClick={() => choose(o.value)}
                className={cn("block w-full px-3 py-1.5 text-left hover:bg-accent",
                  value === o.value && "bg-accent/60 font-medium")}>
                {o.label}
              </button>
            ))}
          </div>
        ))}
        {filtered.length === 0 && <div className="px-3 py-2 text-muted-foreground">No match</div>}
      </div>
    </div>
  );
}
