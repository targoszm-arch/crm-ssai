import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Mail, Plus, Search, MoreHorizontal, RefreshCw, Linkedin, Users, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useCampaigns, useSyncCampaigns, Campaign } from "@/hooks/useCampaigns";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignDetailSheet } from "@/components/campaigns/CampaignDetailSheet";

export default function Campaigns() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  
  const { data: campaigns, isLoading } = useCampaigns(statusFilter);
  const syncMutation = useSyncCampaigns();

  const renderCampaignIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "linkedin":
        return <Linkedin className="h-4 w-4" />;
      case "whatsapp":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Linkedin className="h-4 w-4" />;
    }
  };

  const renderCampaignStatus = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      active: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", label: "Active" },
      draft: { color: "bg-muted text-muted-foreground", label: "Draft" },
      scheduled: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", label: "Scheduled" },
      archived: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", label: "Archived" },
      ended: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", label: "Ended" },
      paused: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Paused" },
    };

    const { color, label } = statusMap[status?.toLowerCase()] || { color: "bg-muted text-muted-foreground", label: status };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  const filteredCampaigns = (campaigns || []).filter(campaign => {
    const matchesSearch = !searchQuery || 
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const campaignColumns = [
    { 
      accessorKey: "name", 
      header: "Campaign Name",
      cell: (campaign: Campaign) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            {renderCampaignIcon(campaign.type)}
          </div>
          <div>
            <div className="font-medium">{campaign.name}</div>
            {campaign.meetalfred_id && (
              <div className="text-sm text-muted-foreground">ID: {campaign.meetalfred_id}</div>
            )}
          </div>
        </div>
      )
    },
    { 
      accessorKey: "type", 
      header: "Type",
      cell: (campaign: Campaign) => (
        <Badge variant="outline" className="capitalize">
          {campaign.type}
        </Badge>
      )
    },
    { 
      accessorKey: "sequence_type", 
      header: "Sequence",
      cell: (campaign: Campaign) => campaign.sequence_type || "-"
    },
    { 
      accessorKey: "total_leads", 
      header: "Leads",
      cell: (campaign: Campaign) => campaign.total_leads?.toLocaleString() || "0"
    },
    { 
      accessorKey: "sent_count", 
      header: "Sent",
      cell: (campaign: Campaign) => campaign.sent_count?.toLocaleString() || "0"
    },
    { 
      accessorKey: "open_rate", 
      header: "Open Rate",
      cell: (campaign: Campaign) => `${campaign.open_rate || 0}%`
    },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: (campaign: Campaign) => renderCampaignStatus(campaign.status)
    },
    { 
      accessorKey: "actions", 
      header: "",
      cell: (campaign: Campaign) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSelectedCampaign(campaign)}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/customers?campaign=${encodeURIComponent(campaign.name)}`)}>
              <Users className="h-4 w-4 mr-2" />
              View Leads
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/inbox?tab=linkedin&campaign=${encodeURIComponent(campaign.name)}`)}>
              <Mail className="h-4 w-4 mr-2" />
              View Messages
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing Campaigns</h1>
          <p className="text-muted-foreground">
            View and manage your Meet Alfred LinkedIn campaigns.
          </p>
        </div>
        <Button 
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Syncing..." : "Sync Meet Alfred"}
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full" onValueChange={setStatusFilter}>
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        
        <TabsContent value={statusFilter} className="space-y-6 mt-6">
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
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Campaign
                </Button>
              </div>
            </CardContent>
          </Card>

          <SectionHeader
            title="Campaign List"
            description={`Showing ${filteredCampaigns.length} campaigns`}
            className="mt-8 mb-4"
          />

          {isLoading ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : filteredCampaigns.length === 0 ? (
            <Card>
              <CardHeader className="text-center">
                <CardTitle>No campaigns found</CardTitle>
                <CardDescription>
                  Click "Sync Meet Alfred" to import your campaigns, or create a new one.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <DataTable
              columns={campaignColumns}
              data={filteredCampaigns}
              emptyMessage="No campaigns found"
            />
          )}
        </TabsContent>
      </Tabs>

      <CampaignDetailSheet 
        campaign={selectedCampaign}
        open={!!selectedCampaign}
        onOpenChange={(open) => !open && setSelectedCampaign(null)}
      />
    </div>
  );
}