import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import {
  Search,
  X,
  Filter,
  Settings,
  ShoppingCart,
  MessageSquare,
  SendHorizonal,
  MegaphoneIcon
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { abandonedCartData, AbandonedCart } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CartAbandonment() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filteredCarts = abandonedCartData.filter(cart => {
    const matchesSearch = !searchQuery || 
      cart.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cart.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cart.customer.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !statusFilter || cart.recoveryStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const renderRecoveryStatus = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      not_attempted: { color: "bg-gray-100 text-gray-800", label: "Not Attempted" },
      email_sent: { color: "bg-blue-100 text-blue-800", label: "Email Sent" },
      sms_sent: { color: "bg-purple-100 text-purple-800", label: "SMS Sent" },
      recovered: { color: "bg-green-100 text-green-800", label: "Recovered" },
      lost: { color: "bg-red-100 text-red-800", label: "Lost" },
    };

    const { color, label } = statusMap[status] || { color: "bg-gray-100 text-gray-800", label: status };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  const cartColumns = [
    { accessorKey: "id", header: "Cart ID" },
    { 
      accessorKey: "customer.name", 
      header: "Customer",
      cell: (cart: AbandonedCart) => (
        <div>
          <div className="font-medium">{cart.customer.name}</div>
          <div className="text-sm text-muted-foreground">{cart.customer.email}</div>
        </div>
      )
    },
    { 
      accessorKey: "amount", 
      header: "Value",
      cell: (cart: AbandonedCart) => (
        <div className="font-medium">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(cart.amount)}
        </div>
      )
    },
    { 
      accessorKey: "items", 
      header: "Items",
      cell: (cart: AbandonedCart) => (
        <Badge variant="outline" className="rounded-full">
          {cart.items} {cart.items === 1 ? 'item' : 'items'}
        </Badge>
      )
    },
    { accessorKey: "abandonedAt", header: "Abandoned At" },
    { 
      accessorKey: "recoveryStatus", 
      header: "Status",
      cell: (cart: AbandonedCart) => renderRecoveryStatus(cart.recoveryStatus)
    },
    { 
      accessorKey: "actions", 
      header: "Actions",
      cell: (cart: AbandonedCart) => (
        <div className="flex space-x-2">
          <Button variant="ghost" size="icon">
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cart Abandonment</h1>
        <p className="text-muted-foreground">
          Track and recover abandoned shopping carts.
        </p>
      </div>

      <Tabs defaultValue="carts" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="carts">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Abandoned Carts
          </TabsTrigger>
          <TabsTrigger value="campaigns">
            <MegaphoneIcon className="mr-2 h-4 w-4" />
            Recovery Campaigns
          </TabsTrigger>
        </TabsList>
        <TabsContent value="carts" className="space-y-6 mt-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-auto flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search carts..."
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
                      <SelectItem value="not_attempted">Not Attempted</SelectItem>
                      <SelectItem value="email_sent">Email Sent</SelectItem>
                      <SelectItem value="sms_sent">SMS Sent</SelectItem>
                      <SelectItem value="recovered">Recovered</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <SectionHeader
            title="Abandoned Cart List"
            description={`Showing ${filteredCarts.length} abandoned carts`}
            className="mt-8 mb-4"
          />

          <DataTable
            columns={cartColumns}
            data={filteredCarts}
            emptyMessage="No abandoned carts found"
          />
        </TabsContent>
        
        <TabsContent value="campaigns" className="space-y-4 mt-6">
          <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center min-h-[300px]">
              <MegaphoneIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Recovery Campaigns</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Create automated email, SMS, and WhatsApp campaigns to recover abandoned carts and boost sales.
              </p>
              <Button>
                Create Campaign
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
