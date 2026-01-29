import { useState, useMemo } from "react";
import { DataTable } from "@/components/ui/data-table";
import { CRMDataFilters, MultiSelectFilterConfig } from "./CRMDataFilters";
import { ColumnSelector } from "./ColumnSelector";
import { useContacts, useContactFilterOptions, Contact, ContactFilters, ContactSorting } from "@/hooks/useContacts";
import { useColumnPreferences, ColumnDefinition } from "@/hooks/useColumnPreferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
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

  const filterConfig: MultiSelectFilterConfig[] = useMemo(() => [
    {
      key: "company",
      label: "Company",
      options: (filterOptions?.companies || []).map((c) => ({ label: c.company_name, value: c.id })),
      selectedValues: filters.companyIds || [],
      onChange: (values) => setFilters((prev) => ({ ...prev, companyIds: values.length ? values : undefined })),
    },
    {
      key: "location",
      label: "Location",
      options: (filterOptions?.workLocations || []).map((l) => ({ label: l, value: l })),
      selectedValues: filters.workLocations || [],
      onChange: (values) => setFilters((prev) => ({ ...prev, workLocations: values.length ? values : undefined })),
    },
    {
      key: "title",
      label: "Job Title",
      options: (filterOptions?.titles || []).map((t) => ({ label: t, value: t })),
      selectedValues: filters.titles || [],
      onChange: (values) => setFilters((prev) => ({ ...prev, titles: values.length ? values : undefined })),
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
    (filters.companyIds && filters.companyIds.length > 0) ||
    (filters.workLocations && filters.workLocations.length > 0) ||
    (filters.titles && filters.titles.length > 0) ||
    (filters.labels && filters.labels.length > 0)
  );

  const handleSort = (column: keyof Contact) => {
    setSorting((prev) => ({
      column,
      direction: prev.column === column && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIcon = (column: keyof Contact) => {
    if (sorting.column !== column) return <ArrowUpDown className="ml-1 h-3 w-3" />;
    return sorting.direction === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const allColumns = [
    {
      id: "name",
      accessorKey: "name",
      header: (
        <Button variant="ghost" className="p-0 h-auto font-medium" onClick={() => handleSort("first_name")}>
          Name {getSortIcon("first_name")}
        </Button>
      ),
      cell: (contact: ContactWithCompany) => {
        const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.name;
        const initials = fullName?.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() || "?";
        
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
              {initials}
            </div>
            <div className="font-medium">{fullName}</div>
          </div>
        );
      },
    },
    {
      id: "connection_strength",
      accessorKey: "connection_strength",
      header: "Connection",
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
      header: "Company",
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
      header: "Title",
      cell: (contact: ContactWithCompany) => <span className="text-sm">{contact.title || "-"}</span>,
    },
    {
      id: "function",
      accessorKey: "function",
      header: "Function",
      cell: (contact: ContactWithCompany) => <span className="text-sm">{contact.function || "-"}</span>,
    },
    {
      id: "labels",
      accessorKey: "labels",
      header: "Labels",
      cell: (contact: ContactWithCompany) => contact.labels ? <Badge variant="outline">{contact.labels}</Badge> : "-",
    },
    {
      id: "email_messages_count",
      accessorKey: "email_messages_count",
      header: "Emails",
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
      header: "Location",
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
      header: "Marketing",
      cell: (contact: ContactWithCompany) => contact.marketing_status ? <Badge variant="secondary">{contact.marketing_status}</Badge> : "-",
    },
    {
      id: "last_contacted",
      accessorKey: "last_contacted",
      header: (
        <Button variant="ghost" className="p-0 h-auto font-medium" onClick={() => handleSort("last_contacted")}>
          Last Activity {getSortIcon("last_contacted")}
        </Button>
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
      header: "Seniority",
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
      header: "Interest",
      cell: (contact: ContactWithCompany) => contact.interest_level ? <Badge variant="secondary">{contact.interest_level}</Badge> : "-",
    },
    {
      id: "lqs",
      accessorKey: "lqs",
      header: "LQS",
      cell: (contact: ContactWithCompany) => <span className="text-sm font-medium">{contact.lqs ?? "-"}</span>,
    },
    {
      id: "actions",
      accessorKey: "actions",
      header: "",
      cell: () => <Button variant="ghost" size="sm">View</Button>,
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
        filters={filterConfig}
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
    </div>
  );
}
