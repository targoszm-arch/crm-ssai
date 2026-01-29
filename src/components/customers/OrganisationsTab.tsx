import { useState, useMemo } from "react";
import { DataTable } from "@/components/ui/data-table";
import { CRMDataFilters, MultiSelectFilterConfig } from "./CRMDataFilters";
import { ColumnSelector } from "./ColumnSelector";
import { useCompanies, useCompanyFilterOptions, Company, CompanyFilters, CompanySorting } from "@/hooks/useCompanies";
import { useColumnPreferences, ColumnDefinition } from "@/hooks/useColumnPreferences";
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

  const { data: companies, isLoading } = useCompanies(filters, sorting);
  const { data: filterOptions } = useCompanyFilterOptions();
  
  const {
    columns: columnPrefs,
    visibleColumns,
    isVisible,
    toggleColumn,
    moveColumnUp,
    moveColumnDown,
    resetToDefault,
  } = useColumnPreferences("organisations", ORGANISATION_COLUMNS);

  const filterConfig: MultiSelectFilterConfig[] = useMemo(() => [
    {
      key: "country",
      label: "Country",
      options: (filterOptions?.countries || []).map((c) => ({ label: c, value: c })),
      selectedValues: filters.countries || [],
      onChange: (values) => setFilters((prev) => ({ ...prev, countries: values.length ? values : undefined })),
    },
    {
      key: "employees",
      label: "Employees",
      options: (filterOptions?.employeeRanges || []).map((e) => ({ label: e, value: e })),
      selectedValues: filters.employeeRanges || [],
      onChange: (values) => setFilters((prev) => ({ ...prev, employeeRanges: values.length ? values : undefined })),
    },
    {
      key: "industry",
      label: "Industry",
      options: (filterOptions?.industries || []).map((i) => ({ label: i, value: i })),
      selectedValues: filters.industries || [],
      onChange: (values) => setFilters((prev) => ({ ...prev, industries: values.length ? values : undefined })),
    },
    {
      key: "labels",
      label: "Labels",
      options: (filterOptions?.labels || []).map((l) => ({ label: l, value: l })),
      selectedValues: filters.labels || [],
      onChange: (values) => setFilters((prev) => ({ ...prev, labels: values.length ? values : undefined })),
    },
  ], [filters, filterOptions]);

  const hasActiveFilters = Boolean(
    filters.search || 
    (filters.countries && filters.countries.length > 0) ||
    (filters.employeeRanges && filters.employeeRanges.length > 0) ||
    (filters.industries && filters.industries.length > 0) ||
    (filters.labels && filters.labels.length > 0)
  );

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

  const allColumns = [
    {
      id: "company_name",
      accessorKey: "company_name",
      header: (
        <Button variant="ghost" className="p-0 h-auto font-medium" onClick={() => handleSort("company_name")}>
          Name {getSortIcon("company_name")}
        </Button>
      ),
      cell: (company: Company) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
            {company.company_name?.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-medium">{company.company_name}</div>
          </div>
        </div>
      ),
    },
    {
      id: "labels",
      accessorKey: "labels",
      header: "Labels",
      cell: (company: Company) => company.labels ? <Badge variant="secondary">{company.labels}</Badge> : "-",
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
      header: "Industry",
      cell: (company: Company) => <span className="text-sm">{company.industry || "-"}</span>,
    },
    {
      id: "annual_turnover",
      accessorKey: "annual_turnover",
      header: "Revenue",
      cell: (company: Company) => <span className="text-sm">{company.annual_turnover ? `$${(company.annual_turnover / 1000000).toFixed(1)}M` : "-"}</span>,
    },
    {
      id: "funding_raised",
      accessorKey: "funding_raised",
      header: "Funding",
      cell: (company: Company) => <span className="text-sm">{company.funding_raised ? `$${(company.funding_raised / 1000000).toFixed(1)}M` : "-"}</span>,
    },
    {
      id: "employee_range",
      accessorKey: "employee_range",
      header: "Employees",
      cell: (company: Company) => <span className="text-sm">{company.employee_range || "-"}</span>,
    },
    {
      id: "people_count",
      accessorKey: "people_count",
      header: "Contacts",
      cell: (company: Company) => <span className="text-sm">{company.people_count ?? "-"}</span>,
    },
    {
      id: "next_activity_date",
      accessorKey: "next_activity_date",
      header: "Next Activity",
      cell: (company: Company) => <span className="text-sm">{company.next_activity_date ? format(new Date(company.next_activity_date), "MMM d") : "-"}</span>,
    },
    {
      id: "done_activities",
      accessorKey: "done_activities",
      header: "Done",
      cell: (company: Company) => <span className="text-sm">{company.done_activities ?? "-"}</span>,
    },
    {
      id: "email_messages_count",
      accessorKey: "email_messages_count",
      header: "Emails",
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
      header: "Founded",
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
        <Button variant="ghost" className="p-0 h-auto font-medium" onClick={() => handleSort("connection_strength")}>
          Connection {getSortIcon("connection_strength")}
        </Button>
      ),
      cell: (company: Company) => getConnectionStrengthBadge(company.connection_strength),
    },
    {
      id: "country",
      accessorKey: "country",
      header: "Country",
      cell: (company: Company) => <span className="text-sm">{company.country || "-"}</span>,
    },
    {
      id: "last_interaction",
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

  const columns = allColumns.filter((col) => isVisible(col.id));

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
        filters={filterConfig}
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
