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
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
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
 * 3. It owns the toolbar. Search inputs were being wrapped in a Card of their
 *    own above the table, which is how a single input ends up looking like a
 *    floating box. A toolbar belongs to the table, inside the same frame.
 */
interface DataTableProps<T> {
  columns: {
    accessorKey: string;
    header: React.ReactNode;
    cell?: (item: T) => React.ReactNode;
  }[];
  data: T[];
  className?: string;
  emptyMessage?: string;
  /** Search, filters, view toggles. Rendered inside the frame, above the rows. */
  toolbar?: React.ReactNode;
  /** Row click handler. Rows get a pointer and a hover when set. */
  onRowClick?: (item: T) => void;
  /** Rows per page. 0 disables paging and renders everything. */
  pageSize?: number;
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
  pagination,
}: DataTableProps<T>) {
  const [pageIndex, setPageIndex] = useState(0);

  // Server paging wins; otherwise page in memory unless asked not to.
  const internal = !pagination && pageSize > 0;
  const pageCount = internal ? Math.max(1, Math.ceil(data.length / pageSize)) : 1;

  // A filter that shortens the data under a page index past the end would
  // otherwise leave the table blank with no way back — clamp instead.
  const safeIndex = Math.min(pageIndex, pageCount - 1);

  const rows = useMemo(
    () => (internal ? data.slice(safeIndex * pageSize, (safeIndex + 1) * pageSize) : data),
    [internal, data, safeIndex, pageSize],
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
          total: data.length,
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

      <div className="relative w-full overflow-x-auto">
        {/* The Table primitive sets w-full, which makes a wide table squeeze its columns
            down to the container instead of overflowing it — so the horizontal scrollbar
            never appears and the right-hand columns get crushed or clipped. min-w-full
            with auto layout lets it fill a narrow table and overflow a wide one. */}
        <Table className="min-w-full">
          <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur">
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead key={column.accessorKey} className="whitespace-nowrap">
                  {column.header}
                </TableHead>
              ))}
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
                    <TableCell key={column.accessorKey}>
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
