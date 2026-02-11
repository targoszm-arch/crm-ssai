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
  MegaphoneIcon,
  UserX,
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
import { SignupAbandonmentTab } from "@/components/recovery/SignupAbandonmentTab";
import { RecoveryCampaignsTab } from "@/components/recovery/RecoveryCampaignsTab";

export default function CartAbandonment() {
  const [searchQuery, setSearchQuery] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filteredCarts = abandonedCartData.filter(cart => {
    const matchesSearch = !searchQuery || 
      cart.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cart.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cart.customer.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !statusFilter || statusFilter === "all" || cart.recoveryStatus === statusFilter;
    
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
        <h1 className="text-2xl font-bold tracking-tight">Recovery Center</h1>
        <p className="text-muted-foreground">
          Track and recover abandoned carts and incomplete signups.
        </p>
      </div>

      <Tabs defaultValue="signups" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="signups">
            <UserX className="mr-2 h-4 w-4" />
            Signup Abandonment
          </TabsTrigger>
          <TabsTrigger value="carts">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Abandoned Carts
          </TabsTrigger>
          <TabsTrigger value="campaigns">
            <MegaphoneIcon className="mr-2 h-4 w-4" />
            Recovery Campaigns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signups" className="space-y-6 mt-6">
          <SignupAbandonmentTab />
        </TabsContent>

        <TabsContent value="carts" className="space-y-6 mt-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-auto flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Press Enter to search..."
                    className="pl-8 w-full"
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && setSearchQuery(localSearch)}
                  />
                  {localSearch && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-9 w-9"
                      onClick={() => { setLocalSearch(""); setSearchQuery(""); }}
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
        
        <TabsContent value="campaigns" className="space-y-6 mt-6">
          <RecoveryCampaignsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
