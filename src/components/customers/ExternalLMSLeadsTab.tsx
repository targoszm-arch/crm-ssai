import { useState } from "react";
import { useExternalLMSCustomers, ExternalLMSCustomer } from "@/hooks/useExternalLMSCustomers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
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
  GraduationCap, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  Search,
  Mail,
  Building2,
  Upload,
} from "lucide-react";
import { format } from "date-fns";
import { EnrollAbandonmentModal } from "@/components/recovery/EnrollAbandonmentModal";

export function ExternalLMSLeadsTab() {
  const [signupType, setSignupType] = useState<string>("");
  const [marketingFilter, setMarketingFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [isSyncingApollo, setIsSyncingApollo] = useState(false);

  const handleSyncToApollo = async () => {
    setIsSyncingApollo(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("sync-leads-apollo", {
        body: { force: false },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (error) throw error;
      toast.success(`Apollo sync complete: ${data?.synced || 0} synced, ${data?.errors || 0} errors`);
    } catch (err: any) {
      toast.error("Apollo sync failed: " + (err.message || "Unknown error"));
    } finally {
      setIsSyncingApollo(false);
    }
  };

  // Fetch all leads once; all filtering happens client-side below.
  const { data: customers, isLoading, isError, error, refetch, isFetching } = useExternalLMSCustomers({
    limit: 500,
  });

  const isActive = (value: string) => value !== "" && value !== "all";

  const filteredCustomers = (customers ?? []).filter((customer) => {
    // Signup type
    if (isActive(signupType) && customer.signup_type !== signupType) return false;

    // LMS status
    if (isActive(statusFilter) && customer.status !== statusFilter) return false;

    // Marketing consent
    if (marketingFilter === "true" && customer.marketing_consent !== true) return false;
    if (marketingFilter === "false" && customer.marketing_consent === true) return false;

    // Free-text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const haystack = [
        customer.full_name,
        customer.email,
        customer.role,
        customer.use_case,
        customer.company_size,
        customer.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredCustomers.map(c => c.email)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (email: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(email);
    } else {
      newSelected.delete(email);
    }
    setSelectedIds(newSelected);
  };

  const selectedUsers = filteredCustomers.filter(c => selectedIds.has(c.email));

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <GraduationCap className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">Failed to load LMS customers</p>
        <p className="text-sm mb-4">{(error as Error)?.message || 'Unknown error'}</p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Press Enter to search..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearchQuery(localSearch)}
            className="pl-9"
          />
        </div>
        
        <Select value={signupType} onValueChange={setSignupType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Signup Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="instructor">Instructor</SelectItem>
            <SelectItem value="learner">Learner</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="LMS Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Verified">Verified</SelectItem>
            <SelectItem value="Instructor Trial">Instructor Trial</SelectItem>
            <SelectItem value="At Risk">At Risk</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
            <SelectItem value="Churned">Churned</SelectItem>
            <SelectItem value="Not Verified">Not Verified</SelectItem>
          </SelectContent>
        </Select>

        <Select value={marketingFilter} onValueChange={setMarketingFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Marketing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Opted In</SelectItem>
            <SelectItem value="false">Not Opted In</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          variant="outline" 
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncToApollo}
          disabled={isSyncingApollo}
        >
          <Upload className={`h-4 w-4 mr-2 ${isSyncingApollo ? 'animate-spin' : ''}`} />
          {isSyncingApollo ? "Syncing..." : "Sync to Apollo"}
        </Button>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedIds.size} customer{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear Selection
              </Button>
              <Button size="sm" onClick={() => setEnrollModalOpen(true)}>
                <Mail className="h-4 w-4 mr-2" />
                Enroll in Sequence
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading LMS customers...
        </div>
      ) : !filteredCustomers?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <GraduationCap className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">No LMS customers found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedIds.size === filteredCustomers.length && filteredCustomers.length > 0}
                    onCheckedChange={(checked) => handleSelectAll(checked === true)}
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
                <TableHead>Credits</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <LMSCustomerRow 
                  key={customer.email} 
                  customer={customer}
                  selected={selectedIds.has(customer.email)}
                  onSelect={(checked) => handleSelectOne(customer.email, checked)}
                  onEnroll={() => {
                    setSelectedIds(new Set([customer.email]));
                    setEnrollModalOpen(true);
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Results count */}
      {filteredCustomers && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredCustomers.length} of {customers?.length || 0} customers
        </p>
      )}

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

interface LMSCustomerRowProps {
  customer: ExternalLMSCustomer;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onEnroll: () => void;
}

function LMSCustomerRow({ customer, selected, onSelect, onEnroll }: LMSCustomerRowProps) {
  const creditsAvailable = (customer.credits_total || 0) - (customer.credits_used || 0);
  const creditsPercentage = customer.credits_total && customer.credits_total > 0 
    ? Math.round((creditsAvailable / customer.credits_total) * 100)
    : 0;

  const getStatusVariant = (status?: string) => {
    switch (status) {
      case "Active": return "default";
      case "Verified":
      case "Instructor Trial": return "secondary";
      case "At Risk":
      case "Churned": return "destructive";
      default: return "outline"; // Inactive, Not Verified, unknown
    }
  };

  return (
    <TooltipProvider>
      <TableRow>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(checked === true)}
          />
        </TableCell>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="truncate">{customer.full_name}</div>
              <div className="text-xs text-muted-foreground truncate">{customer.email}</div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={getStatusVariant(customer.status)} className="capitalize">
            {customer.status || "unknown"}
          </Badge>
        </TableCell>
        <TableCell>
          {customer.signup_type ? (
            <Badge variant="outline" className="capitalize">
              {customer.signup_type}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          {customer.company_size ? (
            <div className="flex items-center gap-1">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm">{customer.company_size}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          {customer.use_case ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm truncate max-w-[120px] block cursor-help">
                  {customer.use_case}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[300px]">
                <p>{customer.use_case}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          {customer.learning_objectives ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm truncate max-w-[120px] block cursor-help">
                  {customer.learning_objectives}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[300px]">
                <p>{customer.learning_objectives}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          {customer.marketing_consent ? (
            <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Opted In
            </Badge>
          ) : (
            <Badge variant="secondary">
              <XCircle className="h-3 w-3 mr-1" />
              No
            </Badge>
          )}
        </TableCell>
        <TableCell>
          {customer.created_at ? (
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {format(new Date(customer.created_at), "MMM d, yyyy")}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2 min-w-[100px]">
            <Progress value={creditsPercentage} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {creditsAvailable}/{customer.credits_total || 0}
            </span>
          </div>
        </TableCell>
        <TableCell>
          {customer.plan ? (
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {customer.plan}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEnroll}
          >
            <Mail className="h-4 w-4 mr-1" />
            Enroll
          </Button>
        </TableCell>
      </TableRow>
    </TooltipProvider>
  );
}
