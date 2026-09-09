import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { CRMDataFilters } from "./CRMDataFilters";
import { ColumnSelector } from "./ColumnSelector";
import { FilterableTableHeader } from "./FilterableTableHeader";
import { ContactDetail } from "./ContactDetail";
import { CustomersBulkActionBar } from "./CustomersBulkActionBar";
import { useContacts, useContactFilterOptions, useDeleteContacts, Contact, ContactFilters, ContactSorting } from "@/hooks/useContacts";
import { useColumnPreferences, ColumnDefinition } from "@/hooks/useColumnPreferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, ExternalLink, Eye, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { renderLabels } from "@/lib/labelColors";
import { toast } from "sonner";
import { enrichContacts, type EnrichProvider } from "@/lib/api/enrichment";
import { useQueryClient } from "@tanstack/react-query";

type ContactWithCompany = Contact & {
  companies?: { company_name: string } | null;
};

const CUSTOMER_COLUMNS: ColumnDefinition[] = [
  { id: "name", label: "Name", defaultVisible: true, locked: true },
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isEnriching, setIsEnriching] = useState(false);
  const queryClient = useQueryClient();

  const handleViewContact = (contact: ContactWithCompany) => {
    setSelectedContact(contact);
    setDetailOpen(true);
  };

  const { data: contacts, isLoading } = useContacts(filters, sorting);
  const { data: filterOptions } = useContactFilterOptions();
  const deleteContacts = useDeleteContacts();

  const handleSelectAll = (checked: boolean) => {
    if (checked && contacts) {
      setSelectedIds(new Set(contacts.map((c: any) => c.id)));
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

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    deleteContacts.mutate(ids, {
      onSuccess: () => {
        toast.success(`Deleted ${ids.length} contact${ids.length !== 1 ? "s" : ""}`);
        setSelectedIds(new Set());
      },
      onError: (err) => {
        toast.error("Failed to delete contacts: " + (err as Error).message);
      },
    });
  };

  const handleBulkExport = () => {
    // ... keep existing code
    const selected = (contacts || []).filter((c: any) => selectedIds.has(c.id));
    const headers = ["First Name", "Last Name", "Email", "Phone", "Title", "Company"];
    const rows = selected.map((c: any) => [
      c.first_name || "",
      c.last_name || "",
      c.email || "",
      c.phone || "",
      c.title || "",
      c.companies?.company_name || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v: string) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts-export.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selected.length} contact${selected.length !== 1 ? "s" : ""}`);
  };

  const handleBulkEnrich = async (provider: EnrichProvider) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsEnriching(true);
    try {
      const result = await enrichContacts(ids, (current, total) => {
        toast.loading(`Enriching ${current} of ${total}...`, { id: "bulk-enrich-contacts" });
      }, provider);
      toast.dismiss("bulk-enrich-contacts");
      toast.success(`Enriched ${result.succeeded} contact${result.succeeded !== 1 ? "s" : ""}${result.failed > 0 ? `, ${result.failed} failed` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setSelectedIds(new Set());
    } catch {
      toast.dismiss("bulk-enrich-contacts");
      toast.error("Enrichment failed");
    } finally {
      setIsEnriching(false);
    }
  };
  
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
      id: "select",
      accessorKey: "select",
      header: (
        <Checkbox
          checked={selectedIds.size === (contacts?.length || 0) && (contacts?.length || 0) > 0}
          onCheckedChange={(checked) => handleSelectAll(checked === true)}
        />
      ),
      cell: (contact: ContactWithCompany) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.has(contact.id)}
            onCheckedChange={(checked) => handleSelectOne(contact.id, checked === true)}
          />
        </div>
      ),
    },
    {
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
            <Link
              to={`/people/${contact.id}?from=customers`}
              className="font-medium text-left hover:text-primary hover:underline transition-colors"
            >
              {fullName}
            </Link>
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
      cell: (contact: ContactWithCompany) => renderLabels(contact.labels),
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

  const columns = allColumns.filter((col) => col.id === "select" || isVisible(col.id));

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

      <CustomersBulkActionBar
        selectedCount={selectedIds.size}
        onDelete={handleBulkDelete}
        onClearSelection={() => setSelectedIds(new Set())}
        onExport={handleBulkExport}
        onEnrich={handleBulkEnrich}
        isDeleting={deleteContacts.isPending}
        isEnriching={isEnriching}
      />

      <div className="text-sm text-muted-foreground">
        Showing {contacts?.length || 0} customers
      </div>

      {contacts?.length ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="hidden items-center gap-4 border-b bg-muted/30 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[auto_minmax(240px,1.6fr)_minmax(180px,1fr)_minmax(220px,1.2fr)_minmax(130px,0.7fr)_auto]">
            <span className="sr-only">Select</span>
            <span>Person</span>
            <span>Company</span>
            <span>Contact</span>
            <span>Activity</span>
            <span className="sr-only">Actions</span>
          </div>
          <div className="divide-y">
            {(contacts as ContactWithCompany[]).map((contact) => {
              const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.name || "Unnamed contact";
              const initials = fullName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div
                  key={contact.id}
                  className="group grid gap-4 px-4 py-4 transition-colors hover:bg-muted/20 lg:grid-cols-[auto_minmax(240px,1.6fr)_minmax(180px,1fr)_minmax(220px,1.2fr)_minmax(130px,0.7fr)_auto] lg:items-center"
                >
                  <div onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      aria-label={`Select ${fullName}`}
                      checked={selectedIds.has(contact.id)}
                      onCheckedChange={(checked) => handleSelectOne(contact.id, checked === true)}
                    />
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 font-semibold text-primary">{initials || <UserRound className="size-4" />}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <Link to={`/people/${contact.id}?from=customers`} className="block truncate font-medium hover:text-primary hover:underline">
                        {fullName}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {contact.title && <span className="truncate">{contact.title}</span>}
                        {contact.connection_strength && <Badge variant="secondary" className="text-[11px]">{contact.connection_strength}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="size-4 shrink-0" />
                    <span className="truncate">{contact.companies?.company_name || "No company"}</span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1 text-sm">
                    {contact.email ? <a href={`mailto:${contact.email}`} className="flex min-w-0 items-center gap-2 truncate text-muted-foreground hover:text-primary"><Mail className="size-4 shrink-0" />{contact.email}</a> : <span className="text-muted-foreground">No email</span>}
                    {contact.phone && <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"><Phone className="size-3.5 shrink-0" />{contact.phone}</a>}
                    {contact.work_location && <span className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="size-3.5 shrink-0" />{contact.work_location}</span>}
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <span>{contact.last_contacted ? format(new Date(contact.last_contacted), "MMM d, yyyy") : "Never contacted"}</span>
                    {typeof contact.email_messages_count === "number" && <span className="text-xs text-muted-foreground">{contact.email_messages_count} email{contact.email_messages_count === 1 ? "" : "s"}</span>}
                  </div>
                  <Button variant="ghost" size="sm" className="justify-self-start lg:justify-self-end" onClick={() => handleViewContact(contact)}>
                    <Eye data-icon="inline-start" />
                    View
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed px-6 py-14 text-center">
          <UserRound className="mx-auto size-10 text-muted-foreground/60" />
          <h3 className="mt-4 font-semibold">No people found</h3>
          <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filters to find contacts.</p>
        </div>
      )}

      <ContactDetail
        contact={selectedContact}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
