import { useState, useMemo } from "react";
import { DataTable } from "@/components/ui/data-table";
import { CRMDataFilters } from "./CRMDataFilters";
import { ColumnSelector } from "./ColumnSelector";
import { FilterableTableHeader } from "./FilterableTableHeader";
import { useCompanies, useCompanyFilterOptions, useDeleteCompanies, Company, CompanyFilters, CompanySorting } from "@/hooks/useCompanies";
import { useColumnPreferences, ColumnDefinition } from "@/hooks/useColumnPreferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink, Eye } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { OrganisationDetail } from "./OrganisationDetail";
import { AddContactModal } from "./AddContactModal";
import { OrganisationsBulkActionBar } from "./OrganisationsBulkActionBar";
import { renderLabels } from "@/lib/labelColors";
import { toast } from "sonner";

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

const ORGANISATION_COLUMNS: ColumnDefinition[] = [
  { id: "company_name", label: "Name", defaultVisible: true },
  { id: "labels", label: "Labels", defaultVisible: false },
  { id: "address", label: "Address", defaultVisible: false },
  { id: "website", label: "Website", defaultVisible: false },
  { id: "linkedin_url", label: "LinkedIn", defaultVisible: true },
  { id: "industry", label: "Industry", defaultVisible: false },
  { id: "annual_turnover", label: "Revenue", defaultVisible: false },
  { id: "funding_raised", label: "Funding Raised", defaultVisible: false },
  { id: "employee_range", label: "Employees", defaultVisible: true },
  { id: "people_count", label: "Contacts", defaultVisible: true },
  { id: "next_activity_date", label: "Next Activity", defaultVisible: false },
  { id: "done_activities", label: "Done Activities", defaultVisible: false },
  { id: "email_messages_count", label: "Emails", defaultVisible: false },
  { id: "description", label: "Description", defaultVisible: false },
  { id: "foundation_date", label: "Founded", defaultVisible: false },
  { id: "domains", label: "Domains", defaultVisible: true },
  { id: "categories", label: "Categories", defaultVisible: false },
  { id: "connection_strength", label: "Connection", defaultVisible: true },
  { id: "country", label: "Country", defaultVisible: true },
  { id: "last_interaction", label: "Last Interaction", defaultVisible: true },
  { id: "actions", label: "Actions", defaultVisible: true },
];

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: companies, isLoading } = useCompanies(filters, sorting);
  const { data: filterOptions } = useCompanyFilterOptions();
  const deleteCompanies = useDeleteCompanies();
  
  const {
    columns: columnPrefs,
    isVisible,
    toggleColumn,
    moveColumnUp,
    moveColumnDown,
    resetToDefault,
  } = useColumnPreferences("organisations", ORGANISATION_COLUMNS);

  // Build filter options for each filterable column
  const countryOptions = useMemo(() => 
    (filterOptions?.countries || []).map((c) => ({ label: c, value: c })),
    [filterOptions?.countries]
  );

  const employeeOptions = useMemo(() => 
    (filterOptions?.employeeRanges || []).map((e) => ({ label: e, value: e })),
    [filterOptions?.employeeRanges]
  );

  const industryOptions = useMemo(() => 
    (filterOptions?.industries || []).map((i) => ({ label: i, value: i })),
    [filterOptions?.industries]
  );

  const labelsOptions = useMemo(() => 
    (filterOptions?.labels || []).map((l) => ({ label: l, value: l })),
    [filterOptions?.labels]
  );

  const connectionOptions = useMemo(() => [
    { label: "Very strong", value: "Very strong" },
    { label: "Strong", value: "Strong" },
    { label: "Good", value: "Good" },
    { label: "Weak", value: "Weak" },
    { label: "Very weak", value: "Very weak" },
  ], []);

  const hasActiveFilters = Boolean(
    filters.search || 
    (filters.countries && filters.countries.length > 0) ||
    (filters.employeeRanges && filters.employeeRanges.length > 0) ||
    (filters.industries && filters.industries.length > 0) ||
    (filters.labels && filters.labels.length > 0) ||
    (filters.connectionStrengths && filters.connectionStrengths.length > 0)
  );

  const handleSort = (column: string, direction: "asc" | "desc") => {
    setSorting({ column: column as keyof Company, direction });
  };

  const handleViewCompany = (company: Company) => {
    setSelectedCompany(company);
    setDetailOpen(true);
  };

  const handleAddContactFromDetail = (companyId: string) => {
    setPreselectedCompanyId(companyId);
    setAddContactOpen(true);
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked && companies) {
      setSelectedIds(new Set(companies.map(c => c.id)));
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

  const handleBulkDelete = async () => {
    try {
      await deleteCompanies.mutateAsync(Array.from(selectedIds));
      toast.success(`Deleted ${selectedIds.size} organisation${selectedIds.size !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error("Failed to delete organisations");
    }
  };

  const handleExportCSV = () => {
    const selectedCompanies = companies?.filter(c => selectedIds.has(c.id)) || [];
    if (selectedCompanies.length === 0) return;

    const headers = ["Name", "Country", "Industry", "Employees", "Website", "LinkedIn", "Connection Strength"];
    const rows = selectedCompanies.map(c => [
      c.company_name || "",
      c.country || "",
      c.industry || "",
      c.employee_range || "",
      c.website || "",
      c.linkedin_url || "",
      c.connection_strength || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `organisations-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedCompanies.length} organisations`);
  };

  const allColumns = [
    {
      id: "select",
      accessorKey: "select",
      header: (
        <Checkbox
          checked={companies?.length ? selectedIds.size === companies.length : false}
          onCheckedChange={(checked) => handleSelectAll(checked === true)}
          aria-label="Select all"
        />
      ),
      cell: (company: Company) => (
        <Checkbox
          checked={selectedIds.has(company.id)}
          onCheckedChange={(checked) => handleSelectOne(company.id, checked === true)}
          aria-label={`Select ${company.company_name}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      id: "company_name",
      accessorKey: "company_name",
      header: (
        <FilterableTableHeader
          label="Name"
          columnId="company_name"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("company_name", dir)}
        />
      ),
      cell: (company: Company) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
            {company.company_name?.substring(0, 2).toUpperCase()}
          </div>
          <button
            type="button"
            onClick={() => handleViewCompany(company)}
            className="font-medium text-left hover:text-primary hover:underline transition-colors"
          >
            {company.company_name}
          </button>
        </div>
      ),
    },
    {
      id: "labels",
      accessorKey: "labels",
      header: (
        <FilterableTableHeader
          label="Labels"
          columnId="labels"
          filterable
          filterOptions={labelsOptions}
          selectedFilterValues={filters.labels || []}
          onFilterChange={(values) => setFilters((prev) => ({ ...prev, labels: values.length ? values : undefined }))}
        />
      ),
      cell: (company: Company) => renderLabels(company.labels),
    },
    {
      id: "address",
      accessorKey: "address",
      header: "Address",
      cell: (company: Company) => <span className="text-sm truncate max-w-[200px] block">{company.address || "-"}</span>,
    },
    {
      id: "website",
      accessorKey: "website",
      header: "Website",
      cell: (company: Company) => company.website ? (
        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
          Visit <ExternalLink className="h-3 w-3" />
        </a>
      ) : "-",
    },
    {
      id: "linkedin_url",
      accessorKey: "linkedin_url",
      header: "LinkedIn",
      cell: (company: Company) => company.linkedin_url ? (
        <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
          LinkedIn <ExternalLink className="h-2.5 w-2.5" />
        </a>
      ) : "-",
    },
    {
      id: "industry",
      accessorKey: "industry",
      header: (
        <FilterableTableHeader
          label="Industry"
          columnId="industry"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("industry", dir)}
          filterable
          filterOptions={industryOptions}
          selectedFilterValues={filters.industries || []}
          onFilterChange={(values) => setFilters((prev) => ({ ...prev, industries: values.length ? values : undefined }))}
        />
      ),
      cell: (company: Company) => <span className="text-sm">{company.industry || "-"}</span>,
    },
    {
      id: "annual_turnover",
      accessorKey: "annual_turnover",
      header: (
        <FilterableTableHeader
          label="Revenue"
          columnId="annual_turnover"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("annual_turnover", dir)}
        />
      ),
      cell: (company: Company) => <span className="text-sm">{company.annual_turnover ? `$${(company.annual_turnover / 1000000).toFixed(1)}M` : "-"}</span>,
    },
    {
      id: "funding_raised",
      accessorKey: "funding_raised",
      header: (
        <FilterableTableHeader
          label="Funding"
          columnId="funding_raised"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("funding_raised", dir)}
        />
      ),
      cell: (company: Company) => <span className="text-sm">{company.funding_raised ? `$${(company.funding_raised / 1000000).toFixed(1)}M` : "-"}</span>,
    },
    {
      id: "employee_range",
      accessorKey: "employee_range",
      header: (
        <FilterableTableHeader
          label="Employees"
          columnId="employee_range"
          filterable
          filterOptions={employeeOptions}
          selectedFilterValues={filters.employeeRanges || []}
          onFilterChange={(values) => setFilters((prev) => ({ ...prev, employeeRanges: values.length ? values : undefined }))}
        />
      ),
      cell: (company: Company) => <span className="text-sm">{company.employee_range || "-"}</span>,
    },
    {
      id: "people_count",
      accessorKey: "people_count",
      header: (
        <FilterableTableHeader
          label="Contacts"
          columnId="people_count"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("people_count", dir)}
        />
      ),
      cell: (company: Company) => <span className="text-sm">{company.people_count ?? "-"}</span>,
    },
    {
      id: "next_activity_date",
      accessorKey: "next_activity_date",
      header: (
        <FilterableTableHeader
          label="Next Activity"
          columnId="next_activity_date"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("next_activity_date", dir)}
        />
      ),
      cell: (company: Company) => <span className="text-sm">{company.next_activity_date ? format(new Date(company.next_activity_date), "MMM d") : "-"}</span>,
    },
    {
      id: "done_activities",
      accessorKey: "done_activities",
      header: (
        <FilterableTableHeader
          label="Done"
          columnId="done_activities"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("done_activities", dir)}
        />
      ),
      cell: (company: Company) => <span className="text-sm">{company.done_activities ?? "-"}</span>,
    },
    {
      id: "email_messages_count",
      accessorKey: "email_messages_count",
      header: (
        <FilterableTableHeader
          label="Emails"
          columnId="email_messages_count"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("email_messages_count", dir)}
        />
      ),
      cell: (company: Company) => <span className="text-sm">{company.email_messages_count ?? "-"}</span>,
    },
    {
      id: "description",
      accessorKey: "description",
      header: "Description",
      cell: (company: Company) => <span className="text-sm truncate max-w-[200px] block">{company.description || "-"}</span>,
    },
    {
      id: "foundation_date",
      accessorKey: "foundation_date",
      header: (
        <FilterableTableHeader
          label="Founded"
          columnId="foundation_date"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("foundation_date", dir)}
        />
      ),
      cell: (company: Company) => <span className="text-sm">{company.foundation_date ? new Date(company.foundation_date).getFullYear() : "-"}</span>,
    },
    {
      id: "domains",
      accessorKey: "domains",
      header: "Domain",
      cell: (company: Company) => <span className="text-sm text-muted-foreground">{company.domains || "-"}</span>,
    },
    {
      id: "categories",
      accessorKey: "categories",
      header: "Categories",
      cell: (company: Company) => company.categories ? <Badge variant="outline">{company.categories}</Badge> : "-",
    },
    {
      id: "connection_strength",
      accessorKey: "connection_strength",
      header: (
        <FilterableTableHeader
          label="Connection"
          columnId="connection_strength"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("connection_strength", dir)}
          filterable
          filterOptions={connectionOptions}
          selectedFilterValues={filters.connectionStrengths || []}
          onFilterChange={(values) => setFilters((prev) => ({ ...prev, connectionStrengths: values.length ? values : undefined }))}
        />
      ),
      cell: (company: Company) => getConnectionStrengthBadge(company.connection_strength),
    },
    {
      id: "country",
      accessorKey: "country",
      header: (
        <FilterableTableHeader
          label="Country"
          columnId="country"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("country", dir)}
          filterable
          filterOptions={countryOptions}
          selectedFilterValues={filters.countries || []}
          onFilterChange={(values) => setFilters((prev) => ({ ...prev, countries: values.length ? values : undefined }))}
        />
      ),
      cell: (company: Company) => <span className="text-sm">{company.country || "-"}</span>,
    },
    {
      id: "last_interaction",
      accessorKey: "last_interaction",
      header: (
        <FilterableTableHeader
          label="Last Interaction"
          columnId="last_interaction"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("last_interaction", dir)}
        />
      ),
      cell: (company: Company) => (
        <span className="text-sm">
          {company.last_interaction ? format(new Date(company.last_interaction), "MMM d, yyyy") : "-"}
        </span>
      ),
    },
    {
      id: "actions",
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

  // Include select column always, then filter others by visibility
  const selectColumn = allColumns.find(col => col.id === "select")!;
  const visibleColumns = [selectColumn, ...allColumns.filter((col) => col.id !== "select" && isVisible(col.id))];

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
      <CRMDataFilters
        searchValue={filters.search || ""}
        onSearchChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
        searchPlaceholder="Search organisations..."
        onClearFilters={() => setFilters({})}
        hasActiveFilters={hasActiveFilters}
      >
        <ColumnSelector
          columns={columnPrefs}
          columnDefinitions={ORGANISATION_COLUMNS}
          onToggle={toggleColumn}
          onMoveUp={moveColumnUp}
          onMoveDown={moveColumnDown}
          onReset={resetToDefault}
        />
      </CRMDataFilters>

      <OrganisationsBulkActionBar
        selectedCount={selectedIds.size}
        onDelete={handleBulkDelete}
        onClearSelection={() => setSelectedIds(new Set())}
        onExport={handleExportCSV}
        isDeleting={deleteCompanies.isPending}
      />

      <div className="text-sm text-muted-foreground">
        Showing {companies?.length || 0} organisations
      </div>

      <DataTable
        columns={visibleColumns}
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
