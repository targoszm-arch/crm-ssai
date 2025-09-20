
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { 
  Search, 
  UserPlus, 
  X, 
  CheckCircle2, 
  XCircle
} from "lucide-react";
import { customerData, Customer } from "@/data/mockData";

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredCustomers = searchQuery
    ? customerData.filter(
        customer =>
          customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.phone.includes(searchQuery)
      )
    : customerData;

  const customerColumns = [
    { 
      accessorKey: "name", 
      header: "Name",
      cell: (customer: Customer) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
            {customer.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <div className="font-medium">{customer.name}</div>
            <div className="text-sm text-muted-foreground">{customer.email}</div>
          </div>
        </div>
      )
    },
    { accessorKey: "phone", header: "Phone" },
    { 
      accessorKey: "totalOrders", 
      header: "Orders",
      cell: (customer: Customer) => (
        <div className="text-center font-medium">{customer.totalOrders}</div>
      )
    },
    { 
      accessorKey: "totalSpent", 
      header: "Total Spent",
      cell: (customer: Customer) => (
        <div className="font-medium">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(customer.totalSpent)}
        </div>
      )
    },
    { accessorKey: "lastOrderDate", header: "Last Order" },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: (customer: Customer) => (
        <div className="flex justify-center">
          {customer.status === "active" ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
              <XCircle className="mr-1 h-3 w-3" />
              Inactive
            </span>
          )}
        </div>
      )
    },
    { 
      accessorKey: "actions", 
      header: "",
      cell: () => (
        <Button variant="ghost" size="sm">View</Button>
      )
    }
  ];

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">
          Manage and view all your customers in one place.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-auto flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search customers..."
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
                  <span className="sr-only">Clear search</span>
                </Button>
              )}
            </div>
            <Button className="w-full sm:w-auto">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </div>
        </CardContent>
      </Card>

      <SectionHeader
        title="Customer List"
        description={`Showing ${filteredCustomers.length} customers`}
        className="mt-8 mb-4"
      />

      <DataTable
        columns={customerColumns}
        data={filteredCustomers}
        emptyMessage="No customers found"
      />
    </div>
  );
}
