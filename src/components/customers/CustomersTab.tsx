import { useState, useMemo } from "react";
import { DataTable } from "@/components/ui/data-table";
import { CRMDataFilters } from "./CRMDataFilters";
import { ColumnSelector } from "./ColumnSelector";
import { FilterableTableHeader } from "./FilterableTableHeader";
import { ContactDetail } from "./ContactDetail";
import { useContacts, useContactFilterOptions, Contact, ContactFilters, ContactSorting } from "@/hooks/useContacts";
import { useColumnPreferences, ColumnDefinition } from "@/hooks/useColumnPreferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Eye } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

type ContactWithCompany = Contact & {
  companies?: { company_name: string } | null;
};

const CUSTOMER_COLUMNS: ColumnDefinition[] = [
  { id: "name", label: "Name", defaultVisible: true },
  { id: "connection_strength", label: "Connection", defaultVisible: false },
  { id: "email", label: "Email", defaultVisible: true },
  { id: "company", label: "Company", defaultVisible: true },
  { id: "notes", label: "Description", defaultVisible: false },
  { id: "title", label: "Job Title", defaultVisible: true },
  { id: "function", label: "Function", defaultVisible: false },
  { id: "labels", label: "Labels", defaultVisible: false },
  { id: "email_messages_count", label: "Emails", defaultVisible: false },
  { id: "phone", label: "Phone", defaultVisible: true },
  { id: "work_location", label: "Location", defaultVisible: false },
  { id: "facebook_url", label: "Facebook", defaultVisible: false },
  { id: "instagram_url", label: "Instagram", defaultVisible: false },
  { id: "linkedin_url", label: "LinkedIn", defaultVisible: false },
  { id: "marketing_status", label: "Marketing Status", defaultVisible: false },
  { id: "last_contacted", label: "Last Activity", defaultVisible: true },
  { id: "last_email_received", label: "Last Email", defaultVisible: false },
  { id: "notes_personalization", label: "Personalisation Notes", defaultVisible: false },
  { id: "seniority_level", label: "Seniority", defaultVisible: false },
  { id: "next_recommended_action", label: "Next Action", defaultVisible: false },
  { id: "buying_signals", label: "Buying Signals", defaultVisible: false },
  { id: "pain_point", label: "Pain Point", defaultVisible: false },
  { id: "interest_level", label: "Interest", defaultVisible: false },
  { id: "lqs", label: "LQS", defaultVisible: false },
  { id: "actions", label: "Actions", defaultVisible: true },
];

export function CustomersTab() {
  const [filters, setFilters] = useState<ContactFilters>({});
  const [sorting, setSorting] = useState<ContactSorting>({ column: "last_contacted", direction: "desc" });
  const [selectedContact, setSelectedContact] = useState<ContactWithCompany | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleViewContact = (contact: ContactWithCompany) => {
    setSelectedContact(contact);
    setDetailOpen(true);
  };

  const { data: contacts, isLoading } = useContacts(filters, sorting);
  const { data: filterOptions } = useContactFilterOptions();
  
  const {
    columns: columnPrefs,
    isVisible,
    toggleColumn,
    moveColumnUp,
    moveColumnDown,
    resetToDefault,
  } = useColumnPreferences("customers", CUSTOMER_COLUMNS);

  // Build filter options for each filterable column
  const companyOptions = useMemo(() => 
    (filterOptions?.companies || []).map((c) => ({ label: c.company_name, value: c.id })),
    [filterOptions?.companies]
  );

  const locationOptions = useMemo(() => 
    (filterOptions?.workLocations || []).map((l) => ({ label: l, value: l })),
    [filterOptions?.workLocations]
  );

  const titleOptions = useMemo(() => 
    (filterOptions?.titles || []).map((t) => ({ label: t, value: t })),
    [filterOptions?.titles]
  );

  const labelsOptions = useMemo(() => 
    (filterOptions?.labels || []).map((l) => ({ label: l, value: l })),
    [filterOptions?.labels]
  );

  const functionOptions = useMemo(() => 
    (filterOptions?.functions || []).map((f) => ({ label: f, value: f })),
    [filterOptions?.functions]
  );

  const marketingStatusOptions = useMemo(() => 
    (filterOptions?.marketingStatuses || []).map((m) => ({ label: m, value: m })),
    [filterOptions?.marketingStatuses]
  );

  const seniorityOptions = useMemo(() => 
    (filterOptions?.seniorityLevels || []).map((s) => ({ label: s, value: s })),
    [filterOptions?.seniorityLevels]
  );

  const interestOptions = useMemo(() => 
    (filterOptions?.interestLevels || []).map((i) => ({ label: i, value: i })),
    [filterOptions?.interestLevels]
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
    (filters.companyIds && filters.companyIds.length > 0) ||
    (filters.workLocations && filters.workLocations.length > 0) ||
    (filters.titles && filters.titles.length > 0) ||
    (filters.labels && filters.labels.length > 0) ||
    (filters.functions && filters.functions.length > 0) ||
    (filters.marketingStatuses && filters.marketingStatuses.length > 0) ||
    (filters.seniorityLevels && filters.seniorityLevels.length > 0) ||
    (filters.interestLevels && filters.interestLevels.length > 0) ||
    (filters.connectionStrengths && filters.connectionStrengths.length > 0)
  );

  const handleSort = (column: string, direction: "asc" | "desc") => {
    setSorting({ column: column as keyof Contact, direction });
  };

  const allColumns = [
    {
      id: "name",
      accessorKey: "name",
      header: (
        <FilterableTableHeader
          label="Name"
          columnId="first_name"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("first_name", dir)}
        />
      ),
      cell: (contact: ContactWithCompany) => {
        const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.name;
        const initials = fullName?.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() || "?";
        
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
              {initials}
            </div>
            <button
              type="button"
              onClick={() => handleViewContact(contact)}
              className="font-medium text-left hover:text-primary hover:underline transition-colors"
            >
              {fullName}
            </button>
          </div>
        );
      },
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
      cell: (contact: ContactWithCompany) => contact.connection_strength ? <Badge variant="secondary">{contact.connection_strength}</Badge> : "-",
    },
    {
      id: "email",
      accessorKey: "email",
      header: "Email",
      cell: (contact: ContactWithCompany) => <span className="text-sm text-muted-foreground">{contact.email || "-"}</span>,
    },
    {
      id: "company",
      accessorKey: "company",
      header: (
        <FilterableTableHeader
          label="Company"
          columnId="company_id"
          filterable
          filterOptions={companyOptions}
          selectedFilterValues={filters.companyIds || []}
          onFilterChange={(values) => setFilters((prev) => ({ ...prev, companyIds: values.length ? values : undefined }))}
        />
      ),
      cell: (contact: ContactWithCompany) => <span className="text-sm">{contact.companies?.company_name || "-"}</span>,
    },
    {
      id: "notes",
      accessorKey: "notes",
      header: "Description",
      cell: (contact: ContactWithCompany) => <span className="text-sm truncate max-w-[200px] block">{contact.notes || "-"}</span>,
    },
    {
      id: "title",
      accessorKey: "title",
      header: (
        <FilterableTableHeader
          label="Title"
          columnId="title"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("title", dir)}
          filterable
          filterOptions={titleOptions}
          selectedFilterValues={filters.titles || []}
          onFilterChange={(values) => setFilters((prev) => ({ ...prev, titles: values.length ? values : undefined }))}
        />
      ),
      cell: (contact: ContactWithCompany) => <span className="text-sm">{contact.title || "-"}</span>,
    },
    {
      id: "function",
      accessorKey: "function",
      header: (
        <FilterableTableHeader
          label="Function"
          columnId="function"
          filterable
          filterOptions={functionOptions}
          selectedFilterValues={filters.functions || []}
          onFilterChange={(values) => setFilters((prev) => ({ ...prev, functions: values.length ? values : undefined }))}
        />
      ),
      cell: (contact: ContactWithCompany) => <span className="text-sm">{contact.function || "-"}</span>,
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
      cell: (contact: ContactWithCompany) => contact.labels ? <Badge variant="outline">{contact.labels}</Badge> : "-",
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
      cell: (contact: ContactWithCompany) => <span className="text-sm">{contact.email_messages_count ?? "-"}</span>,
    },
    {
      id: "phone",
      accessorKey: "phone",
      header: "Phone",
      cell: (contact: ContactWithCompany) => <span className="text-sm">{contact.phone || "-"}</span>,
    },
    {
      id: "work_location",
      accessorKey: "work_location",
      header: (
        <FilterableTableHeader
          label="Location"
          columnId="work_location"
          filterable
          filterOptions={locationOptions}
          selectedFilterValues={filters.workLocations || []}
          onFilterChange={(values) => setFilters((prev) => ({ ...prev, workLocations: values.length ? values : undefined }))}
        />
      ),
      cell: (contact: ContactWithCompany) => <span className="text-sm">{contact.work_location || "-"}</span>,
    },
    {
      id: "facebook_url",
      accessorKey: "facebook_url",
      header: "Facebook",
      cell: (contact: ContactWithCompany) => contact.facebook_url ? (
        <a href={contact.facebook_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
          FB <ExternalLink className="h-2.5 w-2.5" />
        </a>
      ) : "-",
    },
    {
      id: "instagram_url",
      accessorKey: "instagram_url",
      header: "Instagram",
      cell: (contact: ContactWithCompany) => contact.instagram_url ? (
        <a href={contact.instagram_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
          IG <ExternalLink className="h-2.5 w-2.5" />
        </a>
      ) : "-",
    },
    {
      id: "linkedin_url",
      accessorKey: "linkedin_url",
      header: "LinkedIn",
      cell: (contact: ContactWithCompany) => contact.linkedin_url ? (
        <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
          LI <ExternalLink className="h-2.5 w-2.5" />
        </a>
      ) : "-",
    },
    {
      id: "marketing_status",
      accessorKey: "marketing_status",
      header: (
        <FilterableTableHeader
          label="Marketing"
          columnId="marketing_status"
          filterable
          filterOptions={marketingStatusOptions}
          selectedFilterValues={filters.marketingStatuses || []}
          onFilterChange={(values) => setFilters((prev) => ({ ...prev, marketingStatuses: values.length ? values : undefined }))}
        />
      ),
      cell: (contact: ContactWithCompany) => contact.marketing_status ? <Badge variant="secondary">{contact.marketing_status}</Badge> : "-",
    },
    {
      id: "last_contacted",
      accessorKey: "last_contacted",
      header: (
        <FilterableTableHeader
          label="Last Activity"
          columnId="last_contacted"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("last_contacted", dir)}
        />
      ),
      cell: (contact: ContactWithCompany) => (
        <span className="text-sm">
          {contact.last_contacted ? format(new Date(contact.last_contacted), "MMM d, yyyy") : "-"}
        </span>
      ),
    },
    {
      id: "last_email_received",
      accessorKey: "last_email_received",
      header: "Last Email",
      cell: (contact: ContactWithCompany) => (
        <span className="text-sm">
          {contact.last_email_received ? format(new Date(contact.last_email_received), "MMM d") : "-"}
        </span>
      ),
    },
    {
      id: "notes_personalization",
      accessorKey: "notes",
      header: "Personalisation",
      cell: (contact: ContactWithCompany) => <span className="text-sm truncate max-w-[150px] block">{contact.notes || "-"}</span>,
    },
    {
      id: "seniority_level",
      accessorKey: "seniority_level",
      header: (
        <FilterableTableHeader
          label="Seniority"
          columnId="seniority_level"
          filterable
          filterOptions={seniorityOptions}
          selectedFilterValues={filters.seniorityLevels || []}
          onFilterChange={(values) => setFilters((prev) => ({ ...prev, seniorityLevels: values.length ? values : undefined }))}
        />
      ),
      cell: (contact: ContactWithCompany) => contact.seniority_level ? <Badge variant="outline">{contact.seniority_level}</Badge> : "-",
    },
    {
      id: "next_recommended_action",
      accessorKey: "next_recommended_action",
      header: "Next Action",
      cell: (contact: ContactWithCompany) => <span className="text-sm truncate max-w-[150px] block">{contact.next_recommended_action || "-"}</span>,
    },
    {
      id: "buying_signals",
      accessorKey: "buying_signals",
      header: "Buying Signals",
      cell: (contact: ContactWithCompany) => <span className="text-sm truncate max-w-[150px] block">{contact.buying_signals || "-"}</span>,
    },
    {
      id: "pain_point",
      accessorKey: "pain_point",
      header: "Pain Point",
      cell: (contact: ContactWithCompany) => <span className="text-sm truncate max-w-[150px] block">{contact.pain_point || "-"}</span>,
    },
    {
      id: "interest_level",
      accessorKey: "interest_level",
      header: (
        <FilterableTableHeader
          label="Interest"
          columnId="interest_level"
          filterable
          filterOptions={interestOptions}
          selectedFilterValues={filters.interestLevels || []}
          onFilterChange={(values) => setFilters((prev) => ({ ...prev, interestLevels: values.length ? values : undefined }))}
        />
      ),
      cell: (contact: ContactWithCompany) => contact.interest_level ? <Badge variant="secondary">{contact.interest_level}</Badge> : "-",
    },
    {
      id: "lqs",
      accessorKey: "lqs",
      header: (
        <FilterableTableHeader
          label="LQS"
          columnId="lqs"
          sortable
          currentSort={sorting}
          onSort={(dir) => handleSort("lqs", dir)}
        />
      ),
      cell: (contact: ContactWithCompany) => <span className="text-sm font-medium">{contact.lqs ?? "-"}</span>,
    },
    {
      id: "actions",
      accessorKey: "actions",
      header: "",
      cell: (contact: ContactWithCompany) => (
        <Button variant="ghost" size="sm" onClick={() => handleViewContact(contact)}>
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
        searchPlaceholder="Search customers..."
        onClearFilters={() => setFilters({})}
        hasActiveFilters={hasActiveFilters}
      >
        <ColumnSelector
          columns={columnPrefs}
          columnDefinitions={CUSTOMER_COLUMNS}
          onToggle={toggleColumn}
          onMoveUp={moveColumnUp}
          onMoveDown={moveColumnDown}
          onReset={resetToDefault}
        />
      </CRMDataFilters>

      <div className="text-sm text-muted-foreground">
        Showing {contacts?.length || 0} customers
      </div>

      <DataTable
        columns={columns}
        data={contacts || []}
        emptyMessage="No customers found"
      />

      <ContactDetail
        contact={selectedContact}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
