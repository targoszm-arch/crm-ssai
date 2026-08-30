import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Mail, Users, Send, Info } from "lucide-react";
import { useNewsletters, useNewsletterTotals } from "@/hooks/useNewsletters";

const statusStyles: Record<string, string> = {
  sent: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  sending: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled: "bg-muted text-muted-foreground",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function NewslettersTab() {
  const { data: newsletters, isLoading } = useNewsletters();
  const { totals } = useNewsletterTotals();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!newsletters?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No newsletters yet</p>
        <p className="text-sm">Newsletters are pulled from Content Lab, which sends them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Newsletters are sent by Content Lab, not by this CRM, and it reports a recipient
          count per send rather than per-person events. That is why there are no open or
          click rates here — unlike sequences, the data to compute them does not exist.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Send className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.sent}</p>
                <p className="text-sm text-muted-foreground">Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.recipientsReached.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Recipients reached</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {totals.lastSentAt
                    ? format(new Date(totals.lastSentAt), "d MMM yyyy")
                    : "—"}
                </p>
                <p className="text-sm text-muted-foreground">Last sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Recipients</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Scheduled for</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {newsletters.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="max-w-[420px]">
                  <div className="font-medium truncate">{n.subject_line || "(no subject)"}</div>
                  {n.preview_text && (
                    <div className="text-xs text-muted-foreground truncate">{n.preview_text}</div>
                  )}
                  {n.error_message && (
                    <div className="text-xs text-red-600 truncate">{n.error_message}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={statusStyles[(n.status ?? "").toLowerCase()] ?? statusStyles.cancelled}>
                    {n.status ?? "unknown"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {n.recipient_count?.toLocaleString() ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {n.sent_at ? format(new Date(n.sent_at), "d MMM yyyy, HH:mm") : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {n.scheduled_at ? format(new Date(n.scheduled_at), "d MMM yyyy, HH:mm") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
