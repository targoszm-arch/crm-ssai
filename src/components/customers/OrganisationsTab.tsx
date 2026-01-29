import { useState, useMemo } from "react";
import { DataTable } from "@/components/ui/data-table";
import { DataFilters, FilterOption } from "./DataFilters";
import { useCompanies, useCompanyFilterOptions, Company, CompanyFilters, CompanySorting } from "@/hooks/useCompanies";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { OrganisationDetail } from "./OrganisationDetail";
import { AddContactModal } from "./AddContactModal";

function getConnectionStrengthBadge(strength: string | null) {
  if (!strength) return null;
  
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
    "Very strong": { variant: "default", className: "bg-green-500 hover:bg-green-600" },
    "Strong": { variant: "default", className: "bg-green-400 hover:bg-green-500" },
    "Good": { variant: "secondary", className: "bg-blue-500 text-white hover:bg-blue-600" },
    "Weak": { variant: "secondary", className: "bg-yellow-500 text-white hover:bg-yellow-600" },
    "Very weak": { variant: "outline", className: "border-muted-foreground/50" },
  };

  const config = variants[strength] || variants["Very weak"];
  
  return (
    <Badge variant={config.variant} className={config.className}>
      {strength}
    </Badge>
  );
}

interface OrganisationsTabProps {
  onAddContact?: () => void;
}

export function OrganisationsTab({ onAddContact }: OrganisationsTabProps) {
  const [filters, setFilters] = useState<CompanyFilters>({});
  const [sorting, setSorting] = useState<CompanySorting>({ column: "last_interaction", direction: "desc" });
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [preselectedCompanyId, setPreselectedCompanyId] = useState<string | undefined>();

  const { data: companies, isLoading } = useCompanies(filters, sorting);
  const { data: filterOptions } = useCompanyFilterOptions();

  const filterConfig: FilterOption[] = useMemo(() => [
    {
      label: "Connection",
      value: filters.connectionStrength || "all",
      options: (filterOptions?.connectionStrengths || []).map((s) => ({ label: s, value: s })),
      onChange: (value) => setFilters((prev) => ({ ...prev, connectionStrength: value === "all" ? undefined : value })),
    },
    {
      label: "Country",
      value: filters.country || "all",
      options: (filterOptions?.countries || []).map((c) => ({ label: c, value: c })),
      onChange: (value) => setFilters((prev) => ({ ...prev, country: value === "all" ? undefined : value })),
    },
    {
      label: "Employees",
      value: filters.employeeRange || "all",
      options: (filterOptions?.employeeRanges || []).map((e) => ({ label: e, value: e })),
      onChange: (value) => setFilters((prev) => ({ ...prev, employeeRange: value === "all" ? undefined : value })),
    },
  ], [filters, filterOptions]);

  const hasActiveFilters = Boolean(filters.search || filters.connectionStrength || filters.country || filters.employeeRange);

  const handleSort = (column: keyof Company) => {
    setSorting((prev) => ({
      column,
      direction: prev.column === column && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIcon = (column: keyof Company) => {
    if (sorting.column !== column) return <ArrowUpDown className="ml-1 h-3 w-3" />;
    return sorting.direction === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const handleViewCompany = (company: Company) => {
    setSelectedCompany(company);
    setDetailOpen(true);
  };

  const handleAddContactFromDetail = (companyId: string) => {
    setPreselectedCompanyId(companyId);
    setAddContactOpen(true);
  };

  const columns = [
    {
      accessorKey: "company_name",
      header: (
        <Button variant="ghost" className="p-0 h-auto font-medium" onClick={() => handleSort("company_name")}>
          Company Name {getSortIcon("company_name")}
        </Button>
      ),
      cell: (company: Company) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
            {company.company_name?.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-medium">{company.company_name}</div>
            {company.linkedin_url && (
              <a
                href={company.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                LinkedIn <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "domains",
      header: "Domain",
      cell: (company: Company) => (
        <span className="text-sm text-muted-foreground">{company.domains || "-"}</span>
      ),
    },
    {
      accessorKey: "country",
      header: "Country",
      cell: (company: Company) => (
        <span className="text-sm">{company.country || "-"}</span>
      ),
    },
    {
      accessorKey: "connection_strength",
      header: (
        <Button variant="ghost" className="p-0 h-auto font-medium" onClick={() => handleSort("connection_strength")}>
          Connection {getSortIcon("connection_strength")}
        </Button>
      ),
      cell: (company: Company) => getConnectionStrengthBadge(company.connection_strength),
    },
    {
      accessorKey: "last_interaction",
      header: (
        <Button variant="ghost" className="p-0 h-auto font-medium" onClick={() => handleSort("last_interaction")}>
          Last Interaction {getSortIcon("last_interaction")}
        </Button>
      ),
      cell: (company: Company) => (
        <span className="text-sm">
          {company.last_interaction ? format(new Date(company.last_interaction), "MMM d, yyyy") : "-"}
        </span>
      ),
    },
    {
      accessorKey: "employee_range",
      header: "Employees",
      cell: (company: Company) => (
        <span className="text-sm">{company.employee_range || "-"}</span>
      ),
    },
    {
      accessorKey: "actions",
      header: "",
      cell: (company: Company) => (
        <Button variant="ghost" size="sm" onClick={() => handleViewCompany(company)}>
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DataFilters
        searchValue={filters.search || ""}
        onSearchChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
        searchPlaceholder="Search organisations..."
        filters={filterConfig}
        onClearFilters={() => setFilters({})}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="text-sm text-muted-foreground">
        Showing {companies?.length || 0} organisations
      </div>

      <DataTable
        columns={columns}
        data={companies || []}
        emptyMessage="No organisations found"
      />

      <OrganisationDetail
        company={selectedCompany}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAddContact={handleAddContactFromDetail}
      />

      <AddContactModal
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
        preselectedCompanyId={preselectedCompanyId}
      />
    </div>
  );
}