import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  X,
  Filter,
  UserX,
  Calendar,
  Mail,
  CheckCircle,
  Users,
  Building2,
  XCircle,
} from "lucide-react";
import { useExternalLMSCustomers, ExternalLMSCustomer } from "@/hooks/useExternalLMSCustomers";
import { formatDistanceToNow, parseISO, isAfter, subDays, format } from "date-fns";
import { EnrollAbandonmentModal } from "./EnrollAbandonmentModal";

export function SignupAbandonmentTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [signupTypeFilter, setSignupTypeFilter] = useState<string | null>(null);
  const [marketingFilter, setMarketingFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);

  const { data: customers, isLoading, error } = useExternalLMSCustomers();

  // Filter for unverified users only
  const unverifiedUsers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(c => c.verified === false);
  }, [customers]);

  // Apply additional filters
  const filteredUsers = useMemo(() => {
    return unverifiedUsers.filter(user => {
      const matchesSearch = !searchQuery ||
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.company_size?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.use_case?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = !signupTypeFilter || signupTypeFilter === "all" ||
        user.signup_type === signupTypeFilter;

      const matchesMarketing = !marketingFilter || marketingFilter === "all" ||
        (marketingFilter === "yes" && user.marketing_consent) ||
        (marketingFilter === "no" && !user.marketing_consent);

      const matchesStatus = !statusFilter || statusFilter === "all" ||
        user.status === statusFilter;

      return matchesSearch && matchesType && matchesMarketing && matchesStatus;
    });
  }, [unverifiedUsers, searchQuery, signupTypeFilter, marketingFilter, statusFilter]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = unverifiedUsers.length;
    const thisWeek = unverifiedUsers.filter(u => {
      if (!u.created_at) return false;
      return isAfter(parseISO(u.created_at), subDays(new Date(), 7));
    }).length;
    const recoverable = unverifiedUsers.filter(u => u.marketing_consent).length;
    // Recovery rate would need historical data - placeholder for now
    const recoveryRate = 0;

    return { total, thisWeek, recoverable, recoveryRate };
  }, [unverifiedUsers]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredUsers.map(u => u.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const selectedUsers = useMemo(() => {
    return filteredUsers.filter(u => selectedIds.has(u.id));
  }, [filteredUsers, selectedIds]);

  const getDaysPending = (createdAt?: string) => {
    if (!createdAt) return "Unknown";
    try {
      return formatDistanceToNow(parseISO(createdAt), { addSuffix: false });
    } catch {
      return "Unknown";
    }
  };

  const getStatusVariant = (status?: string) => {
    switch (status) {
      case "active": return "default";
      case "trial": return "secondary";
      case "expired": return "destructive";
      default: return "outline";
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-destructive">
          Failed to load abandonment data: {error.message}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Total Unverified"
          value={metrics.total.toString()}
          icon={<UserX className="h-5 w-5" />}
        />
        <MetricCard
          title="This Week"
          value={metrics.thisWeek.toString()}
          icon={<Calendar className="h-5 w-5" />}
        />
        <MetricCard
          title="Recoverable"
          value={metrics.recoverable.toString()}
          icon={<Mail className="h-5 w-5" />}
        />
        <MetricCard
          title="Active Campaigns"
          value="0"
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-auto flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name, email, company..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-9"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select onValueChange={(value) => setSignupTypeFilter(value || null)}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <div className="flex items-center">
                    <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Signup Type" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={(value) => setStatusFilter(value || null)}>
                <SelectTrigger className="w-full sm:w-[130px]">
                  <SelectValue placeholder="LMS Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={(value) => setMarketingFilter(value || null)}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Marketing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Consented</SelectItem>
                  <SelectItem value="no">Not Consented</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedIds.size} user{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear Selection
              </Button>
              <Button size="sm" onClick={() => setEnrollModalOpen(true)}>
                <Mail className="h-4 w-4 mr-2" />
                Enroll in Recovery Sequence
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <TooltipProvider>
        <div className="border rounded-lg overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Loading...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              No unverified signups found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.size === filteredUsers.length && filteredUsers.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>LMS Status</TableHead>
                  <TableHead>Signup Type</TableHead>
                  <TableHead>Company Size</TableHead>
                  <TableHead>Use Case</TableHead>
                  <TableHead>Learning Objectives</TableHead>
                  <TableHead>Marketing</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Days Pending</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const creditsAvailable = (user.credits_total || 0) - (user.credits_used || 0);
                  const creditsPercentage = user.credits_total && user.credits_total > 0 
                    ? Math.round((creditsAvailable / user.credits_total) * 100)
                    : 0;

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(user.id)}
                          onCheckedChange={(checked) => handleSelectOne(user.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(user.status)} className="capitalize">
                          {user.status || "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {user.signup_type || "standard"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.company_size ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{user.company_size}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.use_case ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm truncate max-w-[100px] block cursor-help">
                                {user.use_case}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[300px]">
                              <p>{user.use_case}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.learning_objectives ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm truncate max-w-[100px] block cursor-help">
                                {user.learning_objectives}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[300px]">
                              <p>{user.learning_objectives}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.marketing_consent ? (
                          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.created_at ? (
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(parseISO(user.created_at), "MMM d, yyyy")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">
                          {getDaysPending(user.created_at)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <Progress value={creditsPercentage} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {creditsAvailable}/{user.credits_total || 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="capitalize text-sm">{user.plan || "Free"}</span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedIds(new Set([user.id]));
                            setEnrollModalOpen(true);
                          }}
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Enroll
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </TooltipProvider>

      {/* Enrollment Modal */}
      <EnrollAbandonmentModal
        open={enrollModalOpen}
        onOpenChange={setEnrollModalOpen}
        selectedUsers={selectedUsers}
        onComplete={() => {
          setSelectedIds(new Set());
          setEnrollModalOpen(false);
        }}
      />
    </div>
  );
}
