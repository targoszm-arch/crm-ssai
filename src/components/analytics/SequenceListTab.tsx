import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {sequences.length} sequences across {sortedGroups.length} categories. Categories with
        more than one sequence are the ones the single-sequence view above cannot compare.
      </p>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sequence</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Steps</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedGroups.map(([category, seqs]) => (
              <Fragment key={category}>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={5} className="font-medium text-sm">
                    {category}
                    <span className="ml-2 text-muted-foreground font-normal">
                      {seqs.length} {seqs.length === 1 ? "sequence" : "sequences"}
                    </span>
                  </TableCell>
                </TableRow>
                {seqs.map((seq) => {
                  const steps = seq.steps ?? [];
                  const duration = steps.length ? steps[steps.length - 1].day : 0;
                  return (
                    <TableRow key={seq.id}>
                      <TableCell>
                        <div className="font-medium">{seq.name}</div>
                        {seq.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {seq.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusStyles[seq.status] ?? statusStyles.draft}>
                          {seq.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{steps.length}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {duration} {duration === 1 ? "day" : "days"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectSequence(seq.id)}
                        >
                          <BarChart3 className="h-4 w-4 mr-1" />
                          Analytics
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {allStats && (
        <p className="text-xs text-muted-foreground">
          Across all sequences: {allStats.totalSent ?? 0} sent, {allStats.openRate ?? 0}% open
          rate, {allStats.clickRate ?? 0}% click rate.
        </p>
      )}
    </div>
  );
}
