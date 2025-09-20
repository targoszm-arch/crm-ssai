
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Send, Mail, Phone, Plus, Search, Filter, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

// Mock campaign data
const campaignData = [
  {
    id: "camp-001",
    name: "Summer Sale Promotion",
    type: "email",
    audience: "All Customers",
    status: "active",
    sentCount: 1250,
    openRate: 32,
    conversionRate: 8,
    lastSent: "2023-06-15"
  },
  {
    id: "camp-002",
    name: "Abandoned Cart Recovery",
    type: "whatsapp",
    audience: "Cart Abandoners",
    status: "active",
    sentCount: 450,
    openRate: 68,
    conversionRate: 15,
    lastSent: "2023-06-18"
  },
  {
    id: "camp-003",
    name: "New Product Launch",
    type: "sms",
    audience: "Premium Customers",
    status: "scheduled",
    sentCount: 0,
    openRate: 0,
    conversionRate: 0,
    lastSent: "Not sent yet"
  },
  {
    id: "camp-004",
    name: "Customer Feedback Request",
    type: "email",
    audience: "Recent Buyers",
    status: "ended",
    sentCount: 850,
    openRate: 41,
    conversionRate: 12,
    lastSent: "2023-05-20"
  },
  {
    id: "camp-005",
    name: "Birthday Discount",
    type: "email",
    audience: "All Customers",
    status: "draft",
    sentCount: 0,
    openRate: 0,
    conversionRate: 0,
    lastSent: "Not sent yet"
  }
];

export default function Campaigns() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const renderCampaignIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "whatsapp":
        return <MessageSquare className="h-4 w-4" />;
      case "sms":
        return <Phone className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const renderCampaignStatus = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      active: { color: "bg-green-100 text-green-800", label: "Active" },
      draft: { color: "bg-gray-100 text-gray-800", label: "Draft" },
      scheduled: { color: "bg-blue-100 text-blue-800", label: "Scheduled" },
      ended: { color: "bg-red-100 text-red-800", label: "Ended" }
    };

    const { color, label } = statusMap[status] || { color: "bg-gray-100 text-gray-800", label: status };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  const filteredCampaigns = campaignData.filter(campaign => {
    const matchesSearch = !searchQuery || 
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.audience.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = !typeFilter || campaign.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const campaignColumns = [
    { 
      accessorKey: "name", 
      header: "Campaign Name",
      cell: (campaign: any) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            {renderCampaignIcon(campaign.type)}
          </div>
          <div>
            <div className="font-medium">{campaign.name}</div>
            <div className="text-sm text-muted-foreground">ID: {campaign.id}</div>
          </div>
        </div>
      )
    },
    { 
      accessorKey: "audience", 
      header: "Audience",
      cell: (campaign: any) => (
        <div>
          <Badge variant="outline" className="rounded-full">
            {campaign.audience}
          </Badge>
        </div>
      )
    },
    { 
      accessorKey: "type", 
      header: "Type",
      cell: (campaign: any) => {
        const typeDisplay: Record<string, string> = {
          email: "Email",
          whatsapp: "WhatsApp",
          sms: "SMS"
        };
        return typeDisplay[campaign.type] || campaign.type;
      }
    },
    { 
      accessorKey: "sentCount", 
      header: "Sent",
      cell: (campaign: any) => campaign.sentCount.toLocaleString()
    },
    { 
      accessorKey: "openRate", 
      header: "Open Rate",
      cell: (campaign: any) => `${campaign.openRate}%`
    },
    { 
      accessorKey: "conversionRate", 
      header: "Conversion",
      cell: (campaign: any) => `${campaign.conversionRate}%`
    },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: (campaign: any) => renderCampaignStatus(campaign.status)
    },
    { 
      accessorKey: "actions", 
      header: "",
      cell: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Edit Campaign</DropdownMenuItem>
            <DropdownMenuItem>View Reports</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing Campaigns</h1>
        <p className="text-muted-foreground">
          Create, manage, and track your marketing campaigns across multiple channels.
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all">
            All Campaigns
          </TabsTrigger>
          <TabsTrigger value="active">
            Active
          </TabsTrigger>
          <TabsTrigger value="drafts">
            Drafts
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-6 mt-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-auto flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search campaigns..."
                    className="pl-8 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Campaign
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <SectionHeader
            title="Campaign List"
            description={`Showing ${filteredCampaigns.length} campaigns`}
            className="mt-8 mb-4"
          />

          <DataTable
            columns={campaignColumns}
            data={filteredCampaigns}
            emptyMessage="No campaigns found"
          />
        </TabsContent>
        
        <TabsContent value="active" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={campaignColumns}
                data={campaignData.filter(campaign => campaign.status === "active")}
                emptyMessage="No active campaigns found"
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="drafts" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Draft Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={campaignColumns}
                data={campaignData.filter(campaign => campaign.status === "draft")}
                emptyMessage="No draft campaigns found"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
