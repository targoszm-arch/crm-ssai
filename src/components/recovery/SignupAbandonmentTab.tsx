import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  X,
  Filter,
  UserX,
  Calendar,
  Mail,
  CheckCircle,
  Users,
} from "lucide-react";
import { useExternalLMSCustomers, ExternalLMSCustomer } from "@/hooks/useExternalLMSCustomers";
import { formatDistanceToNow, parseISO, isAfter, subDays } from "date-fns";
import { EnrollAbandonmentModal } from "./EnrollAbandonmentModal";

export function SignupAbandonmentTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [signupTypeFilter, setSignupTypeFilter] = useState<string | null>(null);
  const [marketingFilter, setMarketingFilter] = useState<string | null>(null);
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
        user.email?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = !signupTypeFilter || signupTypeFilter === "all" ||
        user.signup_type === signupTypeFilter;

      const matchesMarketing = !marketingFilter || marketingFilter === "all" ||
        (marketingFilter === "yes" && user.marketing_consent) ||
        (marketingFilter === "no" && !user.marketing_consent);

      return matchesSearch && matchesType && matchesMarketing;
    });
  }, [unverifiedUsers, searchQuery, signupTypeFilter, marketingFilter]);

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

  const columns = [
    {
      accessorKey: "select",
      header: (
        <Checkbox
          checked={selectedIds.size === filteredUsers.length && filteredUsers.length > 0}
          onCheckedChange={handleSelectAll}
        />
      ),
      cell: (user: ExternalLMSCustomer) => (
        <Checkbox
          checked={selectedIds.has(user.id)}
          onCheckedChange={(checked) => handleSelectOne(user.id, checked as boolean)}
        />
      ),
    },
    {
      accessorKey: "full_name",
      header: "Name",
      cell: (user: ExternalLMSCustomer) => (
        <div>
          <div className="font-medium">{user.full_name}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </div>
      ),
    },
    {
      accessorKey: "signup_type",
      header: "Signup Type",
      cell: (user: ExternalLMSCustomer) => (
        <Badge variant="outline" className="capitalize">
          {user.signup_type || "standard"}
        </Badge>
      ),
    },
    {
      accessorKey: "plan",
      header: "Plan",
      cell: (user: ExternalLMSCustomer) => (
        <span className="capitalize">{user.plan || "Free"}</span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Days Pending",
      cell: (user: ExternalLMSCustomer) => (
        <span className="text-muted-foreground">
          {getDaysPending(user.created_at)}
        </span>
      ),
    },
    {
      accessorKey: "marketing_consent",
      header: "Marketing",
      cell: (user: ExternalLMSCustomer) => (
        user.marketing_consent ? (
          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Yes
          </Badge>
        ) : (
          <Badge variant="secondary">No</Badge>
        )
      ),
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (user: ExternalLMSCustomer) => (
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
      ),
    },
  ];

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
                placeholder="Search by name or email..."
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
                <SelectTrigger className="w-full sm:w-[150px]">
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
              <Select onValueChange={(value) => setMarketingFilter(value || null)}>
                <SelectTrigger className="w-full sm:w-[150px]">
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
      <DataTable
        columns={columns}
        data={filteredUsers}
        emptyMessage={isLoading ? "Loading..." : "No unverified signups found"}
      />

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
