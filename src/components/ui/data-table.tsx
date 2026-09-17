import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ChevronsUpDownIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The table every list page renders.
 *
 * Three things it now does that it did not, each of which was visible on
 * every page at once:
 *
 * 1. It draws its own frame. It used to be `rounded-md` and nothing else —
 *    no border, no background — so rows ran edge to edge into the page and a
 *    table was indistinguishable from the text above it. Callers compensated
 *    by wrapping it in a Card, or forgot to, which is why some pages looked
 *    framed and others looked spilled.
 * 2. It paginates itself. The `pagination` prop existed and not one caller
 *    passed it, so every page rendered its entire result set — 2,837 contacts
 *    as 2,837 rows. Paging is now the default and a caller opts out.
 * 3. It sorts. Every list in the app wanted "click a header to sort" and
 *    each one either reimplemented it or went without.
 * 4. It owns the toolbar. Search inputs were being wrapped in a Card of their
 *    own above the table, which is how a single input ends up looking like a
 *    floating box. A toolbar belongs to the table, inside the same frame.
 */
type SortState = { key: string; direction: "asc" | "desc" } | null;

/** Nulls sort last whichever direction you are going — a blank is not a
 *  small value, it is an absent one, and burying it is what a reader wants
 *  either way. */
function compareValues(a: string | number | null, b: string | number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export interface DataTableColumn<T> {
  accessorKey: string;
  header: React.ReactNode;
  cell?: (item: T) => React.ReactNode;
  /** Omit to make the column unsortable — an actions or checkbox column. */
  sortValue?: (item: T) => string | number | null;
  align?: "left" | "right";
  /** A CSS width. Omit and the column sizes to its content. */
  width?: string;
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  className?: string;
  emptyMessage?: string;
  /** Search, filters, view toggles. Rendered inside the frame, above the rows. */
  toolbar?: React.ReactNode;
  /** Row click handler. Rows get a pointer and a hover when set. */
  onRowClick?: (item: T) => void;
  /** Rows per page. 0 disables paging and renders everything. */
  pageSize?: number;
  /** Uncontrolled starting sort. The table owns sort state after that. */
  initialSort?: SortState;
  /** Server-side paging. When given, `data` is one page and this drives the footer. */
  pagination?: {
    pageIndex: number;
    pageSize: number;
    pageCount: number;
    total?: number;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<T>({
  columns,
  data,
  className,
  emptyMessage = "No data available",
  toolbar,
  onRowClick,
  pageSize = 25,
  initialSort = null,
  pagination,
}: DataTableProps<T>) {
  const [pageIndex, setPageIndex] = useState(0);
  const [sort, setSort] = useState<SortState>(initialSort);

  // Server paging means the page in hand is not the whole set, so sorting it
  // would reorder one page against itself and lie about the order. Leave it
  // to the server in that case.
  const sortable = !pagination;
  const sorted = useMemo(() => {
    if (!sortable || !sort) return data;
    const col = columns.find((c) => c.accessorKey === sort.key);
    if (!col?.sortValue) return data;
    const dir = sort.direction === "asc" ? 1 : -1;
    // Copy first: sort() mutates, and `data` is the caller's array — often a
    // memoised query result that React Query hands out by reference.
    return [...data].sort((a, b) => dir * compareValues(col.sortValue!(a), col.sortValue!(b)));
  }, [sortable, sort, data, columns]);

  const toggleSort = (key: string) =>
    setSort((prev) =>
      prev?.key !== key
        ? { key, direction: "asc" }
        : prev.direction === "asc"
          ? { key, direction: "desc" }
          : null,
    );

  // Server paging wins; otherwise page in memory unless asked not to.
  const internal = !pagination && pageSize > 0;
  const pageCount = internal ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;

  // A filter that shortens the data under a page index past the end would
  // otherwise leave the table blank with no way back — clamp instead.
  const safeIndex = Math.min(pageIndex, pageCount - 1);

  const rows = useMemo(
    () => (internal ? sorted.slice(safeIndex * pageSize, (safeIndex + 1) * pageSize) : sorted),
    [internal, sorted, safeIndex, pageSize],
  );

  const footer = pagination
    ? {
        index: pagination.pageIndex,
        size: pagination.pageSize,
        count: pagination.pageCount,
        total: pagination.total ?? pagination.pageCount * pagination.pageSize,
        go: pagination.onPageChange,
      }
    : internal
      ? {
          index: safeIndex,
          size: pageSize,
          count: pageCount,
          total: sorted.length,
          go: setPageIndex,
        }
      : null;

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-lg border bg-card", className)}>
      {toolbar && (
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {toolbar}
        </div>
      )}

      <div className="scroll-visible relative w-full overflow-x-auto">
        {/* The Table primitive sets w-full, which makes a wide table squeeze its columns
            down to the container instead of overflowing it — so the horizontal scrollbar
            never appears and the right-hand columns get crushed or clipped. min-w-full
            with auto layout lets it fill a narrow table and overflow a wide one. */}
        <Table className="min-w-full">
          <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur">
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => {
                const active = sort?.key === column.accessorKey;
                const canSort = sortable && !!column.sortValue;
                return (
                  <TableHead
                    key={column.accessorKey}
                    style={column.width ? { width: column.width } : undefined}
                    className={cn(
                      "whitespace-nowrap",
                      column.align === "right" && "text-right",
                      column.headerClassName,
                    )}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.accessorKey)}
                        className={cn(
                          "-mx-2 inline-flex items-center gap-1.5 rounded px-2 py-1 hover:text-foreground",
                          active ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {column.header}
                        {!active ? (
                          <ChevronsUpDownIcon className="h-3.5 w-3.5 opacity-50" />
                        ) : sort.direction === "asc" ? (
                          <ArrowUpIcon className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDownIcon className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow
                  key={index}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? "cursor-pointer" : undefined}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.accessorKey}
                      className={cn(column.align === "right" && "text-right", column.cellClassName)}
                    >
                      {column.cell
                        ? column.cell(row)
                        : ((row as Record<string, unknown>)[column.accessorKey] as React.ReactNode)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {footer && footer.total > 0 && (
        <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {footer.index * footer.size + 1}–
            {Math.min((footer.index + 1) * footer.size, footer.total)} of{" "}
            {footer.total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <span className="mr-2 text-sm text-muted-foreground">
              Page {footer.index + 1} of {footer.count}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => footer.go(0)}
              disabled={footer.index === 0}
            >
              <ChevronsLeftIcon className="h-4 w-4" />
              <span className="sr-only">First page</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => footer.go(footer.index - 1)}
              disabled={footer.index === 0}
            >
              <ChevronLeftIcon className="h-4 w-4" />
              <span className="sr-only">Previous page</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => footer.go(footer.index + 1)}
              disabled={footer.index >= footer.count - 1}
            >
              <ChevronRightIcon className="h-4 w-4" />
              <span className="sr-only">Next page</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => footer.go(footer.count - 1)}
              disabled={footer.index >= footer.count - 1}
            >
              <ChevronsRightIcon className="h-4 w-4" />
              <span className="sr-only">Last page</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
