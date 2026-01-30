import { useState } from "react";
import { useExternalLMSCustomers, ExternalLMSCustomer } from "@/hooks/useExternalLMSCustomers";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  GraduationCap, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  Search,
  Mail,
  Building2,
  CreditCard,
  Calendar
} from "lucide-react";
import { format } from "date-fns";

export function ExternalLMSLeadsTab() {
  const [signupType, setSignupType] = useState<string>("");
  const [marketingFilter, setMarketingFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: customers, isLoading, isError, error, refetch, isFetching } = useExternalLMSCustomers({
    signupType: signupType || undefined,
    marketing: marketingFilter === "true" ? true : marketingFilter === "false" ? false : undefined,
    limit: 100,
  });

  // Client-side search filtering
  const filteredCustomers = customers?.filter(customer => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      customer.full_name?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.role?.toLowerCase().includes(query) ||
      customer.use_case?.toLowerCase().includes(query)
    );
  });

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
            placeholder="Search by name, email, role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={signupType} onValueChange={setSignupType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Signup Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="instructor">Instructor</SelectItem>
            <SelectItem value="learner">Learner</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>

        <Select value={marketingFilter} onValueChange={setMarketingFilter}>
          <SelectTrigger className="w-[160px]">
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
      </div>

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
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <LMSCustomerRow key={customer.id} customer={customer} />
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
    </div>
  );
}

function LMSCustomerRow({ customer }: { customer: ExternalLMSCustomer }) {
  const creditsPercentage = customer.credits_total && customer.credits_total > 0 
    ? Math.round(((customer.credits_used || 0) / customer.credits_total) * 100)
    : 0;

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          {customer.full_name}
        </div>
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground text-sm">{customer.email}</span>
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
        <span className="capitalize">{customer.role || '—'}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 min-w-[100px]">
          <Progress value={creditsPercentage} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {customer.credits_used || 0}/{customer.credits_total || 0}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {customer.verified ? (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              <XCircle className="h-3 w-3 mr-1" />
              Pending
            </Badge>
          )}
          {customer.marketing_consent && (
            <span title="Marketing opted in">
              <Mail className="h-3.5 w-3.5 text-blue-500" />
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {customer.created_at ? (
          <span className="text-sm text-muted-foreground">
            {format(new Date(customer.created_at), "MMM d, yyyy")}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}
