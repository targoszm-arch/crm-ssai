import { useState, useMemo } from "react";
import { DataTable } from "@/components/ui/data-table";
import { DataFilters, FilterOption } from "./DataFilters";
import { useContacts, useContactFilterOptions, ContactFilters, ContactSorting } from "@/hooks/useContacts";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Tables } from "@/integrations/supabase/types";

type Contact = Tables<"contacts">;

type ContactWithCompany = Contact & {
  companies?: { company_name: string } | null;
};

export function CustomersTab() {
  const [filters, setFilters] = useState<ContactFilters>({});
  const [sorting, setSorting] = useState<ContactSorting>({ column: "last_contacted", direction: "desc" });

  const { data: contacts, isLoading } = useContacts(filters, sorting);
  const { data: filterOptions } = useContactFilterOptions();

  const filterConfig: FilterOption[] = useMemo(() => [
    {
      label: "Company",
      value: filters.companyId || "all",
      options: (filterOptions?.companies || []).map((c) => ({ label: c.company_name, value: c.id })),
      onChange: (value) => setFilters((prev) => ({ ...prev, companyId: value === "all" ? undefined : value })),
    },
    {
      label: "Location",
      value: filters.workLocation || "all",
      options: (filterOptions?.workLocations || []).map((l) => ({ label: l, value: l })),
      onChange: (value) => setFilters((prev) => ({ ...prev, workLocation: value === "all" ? undefined : value })),
    },
  ], [filters, filterOptions]);

  const hasActiveFilters = Boolean(filters.search || filters.companyId || filters.workLocation);

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

  const columns = [
    {
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
            <div>
              <div className="font-medium">{fullName}</div>
              <div className="text-sm text-muted-foreground">{contact.email || "-"}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: (contact: ContactWithCompany) => (
        <span className="text-sm">{contact.phone || "-"}</span>
      ),
    },
    {
      accessorKey: "company",
      header: "Company",
      cell: (contact: ContactWithCompany) => (
        <span className="text-sm">{contact.companies?.company_name || "-"}</span>
      ),
    },
    {
      accessorKey: "title",
      header: "Title",
      cell: (contact: ContactWithCompany) => (
        <span className="text-sm">{contact.title || "-"}</span>
      ),
    },
    {
      accessorKey: "last_contacted",
      header: (
        <Button variant="ghost" className="p-0 h-auto font-medium" onClick={() => handleSort("last_contacted")}>
          Last Contacted {getSortIcon("last_contacted")}
        </Button>
      ),
      cell: (contact: ContactWithCompany) => (
        <span className="text-sm">
          {contact.last_contacted ? format(new Date(contact.last_contacted), "MMM d, yyyy") : "-"}
        </span>
      ),
    },
    {
      accessorKey: "work_location",
      header: "Location",
      cell: (contact: ContactWithCompany) => (
        <span className="text-sm">{contact.work_location || "-"}</span>
      ),
    },
    {
      accessorKey: "actions",
      header: "",
      cell: () => <Button variant="ghost" size="sm">View</Button>,
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
        searchPlaceholder="Search customers..."
        filters={filterConfig}
        onClearFilters={() => setFilters({})}
        hasActiveFilters={hasActiveFilters}
      />

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
