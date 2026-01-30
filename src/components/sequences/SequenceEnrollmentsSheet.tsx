import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MoreHorizontal,
  Pause,
  Play,
  X,
  Users,
  Mail,
  Clock,
  CheckCircle,
} from "lucide-react";
import { format } from "date-fns";
import { Sequence, useSequenceEnrollments, useUpdateEnrollment } from "@/hooks/useSequences";

interface SequenceEnrollmentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence: Sequence | null;
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled: "bg-muted text-muted-foreground",
};

export function SequenceEnrollmentsSheet({
  open,
  onOpenChange,
  sequence,
}: SequenceEnrollmentsSheetProps) {
  const { data: enrollments, isLoading } = useSequenceEnrollments(sequence?.id);
  const updateEnrollment = useUpdateEnrollment();

  const handleStatusChange = (enrollmentId: string, status: string) => {
    updateEnrollment.mutate({ id: enrollmentId, status });
  };

  const getProgress = (currentStep: number, totalSteps: number) => {
    if (totalSteps === 0) return 0;
    return Math.round((currentStep / totalSteps) * 100);
  };

  const getInitials = (firstName?: string, lastName?: string | null) => {
    if (!firstName) return "?";
    return `${firstName.charAt(0)}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const activeCount = enrollments?.filter((e) => e.status === "active").length || 0;
  const completedCount = enrollments?.filter((e) => e.status === "completed").length || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Sequence Enrollments</SheetTitle>
          <SheetDescription>{sequence?.name}</SheetDescription>
        </SheetHeader>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold">{enrollments?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-lg font-semibold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-lg font-semibold">{completedCount}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-250px)]">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : enrollments?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No enrollments yet</p>
              <p className="text-sm">Enroll contacts to start this sequence.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {enrollments?.map((enrollment: any) => {
                const contact = enrollment.contacts;
                const totalSteps = sequence?.steps.length || 0;
                const progress = getProgress(enrollment.current_step, totalSteps);

                return (
                  <div
                    key={enrollment.id}
                    className="p-4 border rounded-lg space-y-3 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={contact?.avatar} />
                          <AvatarFallback>
                            {getInitials(contact?.first_name, contact?.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {contact?.first_name} {contact?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {contact?.email || "No email"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[enrollment.status] || statusColors.cancelled}>
                          {enrollment.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {enrollment.status === "active" ? (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(enrollment.id, "paused")}
                              >
                                <Pause className="h-4 w-4 mr-2" />
                                Pause
                              </DropdownMenuItem>
                            ) : enrollment.status === "paused" ? (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(enrollment.id, "active")}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Resume
                              </DropdownMenuItem>
                            ) : null}
                            {enrollment.status !== "cancelled" && enrollment.status !== "completed" && (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(enrollment.id, "cancelled")}
                                className="text-destructive"
                              >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Step {enrollment.current_step} of {totalSteps}
                        </span>
                        <span className="text-muted-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>

                    {/* Info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Enrolled {format(new Date(enrollment.enrolled_at), "MMM d, yyyy")}
                      </div>
                      {enrollment.next_email_at && enrollment.status === "active" && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          Next: {format(new Date(enrollment.next_email_at), "MMM d")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
