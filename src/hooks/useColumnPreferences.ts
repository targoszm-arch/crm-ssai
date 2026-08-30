import { useState, useCallback, useEffect } from "react";

export interface ColumnDefinition {
  id: string;
  label: string;
  defaultVisible: boolean;
  /**
   * Identity columns (a person's name, a company's name) cannot be hidden. A table whose
   * rows cannot be told apart is not a usable table, and preferences are persisted, so one
   * accidental toggle leaves it that way for good.
   */
  locked?: boolean;
}

export interface ColumnPreference {
  id: string;
  visible: boolean;
  order: number;
}

interface UseColumnPreferencesReturn {
  columns: ColumnPreference[];
  visibleColumns: string[];
  isVisible: (columnId: string) => boolean;
  toggleColumn: (columnId: string) => void;
  reorderColumn: (fromIndex: number, toIndex: number) => void;
  resetToDefault: () => void;
  moveColumnUp: (columnId: string) => void;
  moveColumnDown: (columnId: string) => void;
}

export function useColumnPreferences(
  tableKey: string,
  defaultColumns: ColumnDefinition[]
): UseColumnPreferencesReturn {
  const storageKey = `column-preferences-${tableKey}`;

  const getDefaultPreferences = useCallback((): ColumnPreference[] => {
    return defaultColumns.map((col, index) => ({
      id: col.id,
      visible: col.defaultVisible,
      order: index,
    }));
  }, [defaultColumns]);

  const [columns, setColumns] = useState<ColumnPreference[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ColumnPreference[];
        // Merge with defaults to handle new columns
        const storedIds = new Set(parsed.map((p) => p.id));
        const merged = [...parsed];
        
        defaultColumns.forEach((col, index) => {
          if (!storedIds.has(col.id)) {
            merged.push({
              id: col.id,
              visible: col.defaultVisible,
              order: parsed.length + index,
            });
          }
        });
        
        // Remove columns that no longer exist
        const defaultIds = new Set(defaultColumns.map((c) => c.id));
        const lockedIds = new Set(
          defaultColumns.filter((c) => c.locked).map((c) => c.id),
        );
        // Repair stored preferences that hide a locked column — including ones saved
        // before the column was locked.
        return merged
          .filter((p) => defaultIds.has(p.id))
          .map((p) => (lockedIds.has(p.id) ? { ...p, visible: true } : p));
      }
    } catch {
      // Ignore localStorage errors
    }
    return getDefaultPreferences();
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(columns));
    } catch {
      // Ignore localStorage errors
    }
  }, [columns, storageKey]);

  const visibleColumns = columns
    .filter((col) => col.visible)
    .sort((a, b) => a.order - b.order)
    .map((col) => col.id);

  const isVisible = useCallback(
    (columnId: string) => {
      const col = columns.find((c) => c.id === columnId);
      return col?.visible ?? false;
    },
    [columns]
  );

  const toggleColumn = useCallback(
    (columnId: string) => {
      if (defaultColumns.some((c) => c.id === columnId && c.locked)) return;
      setColumns((prev) =>
        prev.map((col) =>
          col.id === columnId ? { ...col, visible: !col.visible } : col,
        ),
      );
    },
    [defaultColumns],
  );

  const reorderColumn = useCallback((fromIndex: number, toIndex: number) => {
    setColumns((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const [removed] = sorted.splice(fromIndex, 1);
      sorted.splice(toIndex, 0, removed);
      
      return sorted.map((col, index) => ({ ...col, order: index }));
    });
  }, []);

  const moveColumnUp = useCallback((columnId: string) => {
    setColumns((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((c) => c.id === columnId);
      if (index <= 0) return prev;
      
      [sorted[index - 1], sorted[index]] = [sorted[index], sorted[index - 1]];
      return sorted.map((col, i) => ({ ...col, order: i }));
    });
  }, []);

  const moveColumnDown = useCallback((columnId: string) => {
    setColumns((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((c) => c.id === columnId);
      if (index < 0 || index >= sorted.length - 1) return prev;
      
      [sorted[index], sorted[index + 1]] = [sorted[index + 1], sorted[index]];
      return sorted.map((col, i) => ({ ...col, order: i }));
    });
  }, []);

  const resetToDefault = useCallback(() => {
    setColumns(getDefaultPreferences());
  }, [getDefaultPreferences]);

  return {
    columns,
    visibleColumns,
    isVisible,
    toggleColumn,
    reorderColumn,
    resetToDefault,
    moveColumnUp,
    moveColumnDown,
  };
}
