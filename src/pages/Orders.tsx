import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import {
  Search,
  PlusCircle,
  X,
  Filter,
  Download,
  Package
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orderData, Order } from "@/data/mockData";

export default function Orders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filteredOrders = orderData.filter(order => {
    const matchesSearch = !searchQuery || 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !statusFilter || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const renderOrderStatus = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      pending: { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
      processing: { color: "bg-blue-100 text-blue-800", label: "Processing" },
      completed: { color: "bg-green-100 text-green-800", label: "Completed" },
      cancelled: { color: "bg-red-100 text-red-800", label: "Cancelled" },
      refunded: { color: "bg-gray-100 text-gray-800", label: "Refunded" },
    };

    const { color, label } = statusMap[status] || { color: "bg-gray-100 text-gray-800", label: status };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  const orderColumns = [
    { accessorKey: "id", header: "Order ID" },
    { 
      accessorKey: "customer.name", 
      header: "Customer",
      cell: (order: Order) => (
        <div>
          <div className="font-medium">{order.customer.name}</div>
          <div className="text-sm text-muted-foreground">{order.customer.email}</div>
        </div>
      )
    },
    { 
      accessorKey: "amount", 
      header: "Amount",
      cell: (order: Order) => (
        <div className="font-medium">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(order.amount)}
        </div>
      )
    },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: (order: Order) => renderOrderStatus(order.status)
    },
    { accessorKey: "date", header: "Date" },
    { 
      accessorKey: "items", 
      header: "Items",
      cell: (order: Order) => (
        <Badge variant="outline" className="rounded-full">
          {order.items} {order.items === 1 ? 'item' : 'items'}
        </Badge>
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
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">
          View and manage all your customer orders in one place.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-auto flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search orders..."
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
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select onValueChange={(value) => setStatusFilter(value || null)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <div className="flex items-center">
                    <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" className="w-full sm:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <Button className="w-full sm:w-auto">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Order
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <SectionHeader
        title="Order List"
        description={`Showing ${filteredOrders.length} orders`}
        className="mt-8 mb-4"
      />

      <DataTable
        columns={orderColumns}
        data={filteredOrders}
        emptyMessage="No orders found"
      />
    </div>
  );
}
