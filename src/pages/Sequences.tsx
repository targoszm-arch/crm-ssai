import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, Play, Pause, MoreHorizontal, Plus, 
  Users, Clock, BarChart3, UserPlus, Copy, Edit
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useSequences, useUpdateSequence, useCreateSequence, useSequenceStats, Sequence } from "@/hooks/useSequences";
import { Skeleton } from "@/components/ui/skeleton";
import { SequenceBuilderSheet } from "@/components/sequences/SequenceBuilderSheet";
import { EnrollContactModal } from "@/components/sequences/EnrollContactModal";
import { SequenceEnrollmentsSheet } from "@/components/sequences/SequenceEnrollmentsSheet";

const triggerTypeLabels: Record<string, string> = {
  new_customer: "New Customer",
  post_purchase: "Post Purchase",
  manual: "Manual",
  signup: "Signup",
  content_download: "Content Download",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  draft: "bg-muted text-muted-foreground",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export default function Sequences() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: sequences, isLoading } = useSequences(statusFilter === "all" ? undefined : statusFilter);
  const { data: stats } = useSequenceStats();
  const updateSequence = useUpdateSequence();
  const createSequence = useCreateSequence();

  // Modal/sheet states
  const [builderOpen, setBuilderOpen] = useState(false);
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollmentsOpen, setEnrollmentsOpen] = useState(false);
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null);

  const getSequenceStats = (sequence: Sequence) => {
    const steps = sequence.steps || [];
    const totalDays = steps.length > 0 ? steps[steps.length - 1].day : 0;
    return {
      stepCount: steps.length,
      duration: totalDays,
    };
  };

  const handleCreateNew = () => {
    setSelectedSequence(null);
    setBuilderOpen(true);
  };

  const handleEdit = (sequence: Sequence) => {
    setSelectedSequence(sequence);
    setBuilderOpen(true);
  };

  const handleViewEnrollments = (sequence: Sequence) => {
    setSelectedSequence(sequence);
    setEnrollmentsOpen(true);
  };

  const handleEnrollContacts = (sequence: Sequence) => {
    setSelectedSequence(sequence);
    setEnrollModalOpen(true);
  };

  const handleToggleStatus = (sequence: Sequence) => {
    const newStatus = sequence.status === "active" ? "paused" : "active";
    updateSequence.mutate({ id: sequence.id, status: newStatus });
  };

  const handleDuplicate = (sequence: Sequence) => {
    createSequence.mutate({
      name: `${sequence.name} (Copy)`,
      description: sequence.description,
      trigger_type: sequence.trigger_type,
      steps: sequence.steps,
      from_email: sequence.from_email,
      from_name: sequence.from_name,
      status: "draft",
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Email Sequences</h1>
          <p className="text-muted-foreground">
            Automate your email campaigns with pre-built sequences.
          </p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="mr-2 h-4 w-4" />
          Create Sequence
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sequences?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Sequences</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Play className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {sequences?.filter(s => s.status === "active").length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.enrolledCount || 0}</p>
                <p className="text-sm text-muted-foreground">Enrolled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.openRate || 0}%</p>
                <p className="text-sm text-muted-foreground">Avg Open Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resend Configuration Notice */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Resend Configuration
          </CardTitle>
          <CardDescription>
            Configure these settings in your Resend dashboard to enable email sending:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-medium">Webhook URL:</p>
            <code className="text-xs bg-muted px-2 py-1 rounded block mt-1 break-all">
              https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/resend-webhook
            </code>
          </div>
          <div>
            <p className="text-sm font-medium">Domain to verify:</p>
            <code className="text-xs bg-muted px-2 py-1 rounded block mt-1">
              crm-ssai.lovable.app
            </code>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all" className="w-full" onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All Sequences</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
        </TabsList>
        
        <TabsContent value={statusFilter} className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6 space-y-4">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sequences?.length === 0 ? (
            <Card>
              <CardHeader className="text-center py-12">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <CardTitle>No sequences found</CardTitle>
                <CardDescription>
                  Create your first email sequence to start automating your outreach.
                </CardDescription>
                <Button className="mt-4" onClick={handleCreateNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Sequence
                </Button>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sequences?.map((sequence) => {
                const seqStats = getSequenceStats(sequence);
                return (
                  <Card key={sequence.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{sequence.name}</CardTitle>
                          <CardDescription className="line-clamp-2">
                            {sequence.description || "No description"}
                          </CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleEdit(sequence)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Sequence
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEnrollContacts(sequence)}>
                              <UserPlus className="mr-2 h-4 w-4" />
                              Enroll Contacts
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewEnrollments(sequence)}>
                              <Users className="mr-2 h-4 w-4" />
                              View Enrollments
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(sequence)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {sequence.status === "active" ? (
                              <DropdownMenuItem onClick={() => handleToggleStatus(sequence)}>
                                <Pause className="mr-2 h-4 w-4" />
                                Pause
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleToggleStatus(sequence)}>
                                <Play className="mr-2 h-4 w-4" />
                                Activate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={statusColors[sequence.status] || statusColors.draft}>
                          {sequence.status}
                        </Badge>
                        <Badge variant="outline">
                          {triggerTypeLabels[sequence.trigger_type] || sequence.trigger_type}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          <span>{seqStats.stepCount} emails</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{seqStats.duration} days</span>
                        </div>
                      </div>

                      {/* Steps preview */}
                      <div className="border-t pt-3">
                        <p className="text-xs text-muted-foreground mb-2">Email Steps:</p>
                        <div className="space-y-1">
                          {sequence.steps.slice(0, 3).map((step, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">Day {step.day}:</span>
                              <span className="truncate">{step.subject}</span>
                            </div>
                          ))}
                          {sequence.steps.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{sequence.steps.length - 3} more emails
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals and Sheets */}
      <SequenceBuilderSheet
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        sequence={selectedSequence}
      />
      <EnrollContactModal
        open={enrollModalOpen}
        onOpenChange={setEnrollModalOpen}
        sequence={selectedSequence}
      />
      <SequenceEnrollmentsSheet
        open={enrollmentsOpen}
        onOpenChange={setEnrollmentsOpen}
        sequence={selectedSequence}
      />
    </div>
  );
}
