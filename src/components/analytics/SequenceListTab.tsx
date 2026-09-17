import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table } from "@/components/ui/table";
import { BarChart3, Layers } from "lucide-react";
import { useSequences, Sequence } from "@/hooks/useSequences";
import { useAllSequencesAnalytics } from "@/hooks/useSequenceAnalytics";

const statusStyles: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  draft: "bg-muted text-muted-foreground",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

interface SequenceListTabProps {
  onSelectSequence: (sequenceId: string) => void;
}

/**
 * Every sequence, grouped by category.
 *
 * The rest of this page shows one sequence at a time, chosen from a dropdown. That works
 * until a category has been run more than once — then the repeated runs are only
 * comparable by picking each in turn and remembering the numbers. This lists them together
 * so a category with four runs reads as four rows under one heading.
 */
export function SequenceListTab({ onSelectSequence }: SequenceListTabProps) {
  const { data: sequences, isLoading } = useSequences();
  const { data: allStats } = useAllSequencesAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!sequences?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Layers className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No sequences yet</p>
      </div>
    );
  }

  // Group by category, falling back to trigger_type for anything not categorised.
  const groups = new Map<string, Sequence[]>();
  for (const seq of sequences) {
    const key = (seq as Sequence & { category?: string }).category
      || seq.trigger_type
      || "Uncategorised";
    const list = groups.get(key) ?? [];
    list.push(seq);
    groups.set(key, list);
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  /**
   * One row per sequence, carrying its category.
   *
   * This was a bare <Table> with a colSpan header row per category. That gave
   * the grouping but nothing else: no frame, no paging, no sorting, and a
   * header that scrolled away. The shared DataTable — the one the Abandonment
   * page uses — cannot render group heads, so the category becomes a sortable
   * column instead and the table opens sorted by it. Same information, and
   * every other column is sortable too, which the grouped version blocked.
   */
  const rows = sortedGroups.flatMap(([category, seqs]) =>
    seqs.map(seq => {
      const steps = seq.steps ?? [];
      return {
        seq,
        category,
        steps: steps.length,
        duration: steps.length ? steps[steps.length - 1].day : 0,
        // A sequence that has never sent gets a dash, not a zero: "0% open
        // rate" reads as copy that failed, when nothing went out at all.
        stats: allStats?.bySequence?.[seq.id],
      };
    }),
  );
  type Row = typeof rows[number];

  const num = (v: React.ReactNode | undefined, has: boolean) =>
    has ? <span className="tabular-nums">{v}</span>
        : <span className="tabular-nums text-muted-foreground">—</span>;

  const columns: DataTableColumn<Row>[] = [
    {
      accessorKey: "category", header: "Category",
      sortValue: r => r.category,
      cell: r => <span className="text-sm text-muted-foreground">{r.category}</span>,
    },
    {
      accessorKey: "name", header: "Sequence",
      sortValue: r => r.seq.name ?? "",
      cell: r => (
        <div>
          <div className="font-medium">{r.seq.name}</div>
          {r.seq.description && (
            <div className="line-clamp-1 text-xs text-muted-foreground">{r.seq.description}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "status", header: "Status",
      sortValue: r => r.seq.status ?? "",
      cell: r => (
        <Badge className={statusStyles[r.seq.status] ?? statusStyles.draft}>{r.seq.status}</Badge>
      ),
    },
    { accessorKey: "steps", header: "Steps", align: "right",
      sortValue: r => r.steps, cell: r => num(r.steps, true) },
    { accessorKey: "duration", header: "Duration", align: "right",
      sortValue: r => r.duration,
      cell: r => num(`${r.duration} ${r.duration === 1 ? "day" : "days"}`, true) },
    { accessorKey: "sent", header: "Sent", align: "right",
      sortValue: r => r.stats?.sent ?? null, cell: r => num(r.stats?.sent, !!r.stats) },
    { accessorKey: "opened", header: "Opened", align: "right",
      sortValue: r => r.stats?.opened ?? null, cell: r => num(r.stats?.opened, !!r.stats) },
    { accessorKey: "openRate", header: "Open rate", align: "right",
      sortValue: r => r.stats?.openRate ?? null,
      cell: r => num(r.stats ? `${r.stats.openRate}%` : undefined, !!r.stats) },
    { accessorKey: "clicked", header: "Clicked", align: "right",
      sortValue: r => r.stats?.clicked ?? null, cell: r => num(r.stats?.clicked, !!r.stats) },
    {
      accessorKey: "actions", header: "", align: "right",
      cell: r => (
        <Button variant="ghost" size="sm" onClick={() => onSelectSequence(r.seq.id)}>
          <BarChart3 className="mr-1 h-4 w-4" />
          Analytics
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {sequences.length} sequences across {sortedGroups.length} categories. Categories with
        more than one sequence are the ones the single-sequence view above cannot compare.
      </p>

      <DataTable
        columns={columns}
        data={rows}
        initialSort={{ key: "category", direction: "asc" }}
        emptyMessage="No sequences yet."
      />

      {allStats && (
        <p className="text-xs text-muted-foreground">
          Across all sequences: {allStats.totalSent ?? 0} sent, {allStats.openRate ?? 0}% open
          rate, {allStats.clickRate ?? 0}% click rate.
        </p>
      )}
    </div>
  );
}
