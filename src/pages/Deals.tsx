import { useState } from "react";
import { Plus, Search, LayoutGrid, List, Table, TrendingUp, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePipelines, usePipelineStages } from "@/hooks/usePipelines";
import { useDealsByStage, Deal } from "@/hooks/useDeals";
import { PipelineBoard } from "@/components/deals/PipelineBoard";
import { AddDealModal } from "@/components/deals/AddDealModal";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ViewMode = "kanban" | "list" | "table" | "forecast";

export default function Deals() {
  const [search, setSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | undefined>();
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [addDealInitialStage, setAddDealInitialStage] = useState<string | undefined>();
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const activePipelineId = selectedPipelineId || pipelines?.find(p => p.is_default)?.id || pipelines?.[0]?.id;
  const { data: stages } = usePipelineStages(activePipelineId);
  const { dealsByStage, isLoading: dealsLoading } = useDealsByStage(activePipelineId);

  const activePipeline = pipelines?.find(p => p.id === activePipelineId);

  const handleAddDeal = (stage?: string) => {
    setAddDealInitialStage(stage);
    setAddDealOpen(true);
  };

  const handleDealClick = (deal: Deal) => {
    setSelectedDeal(deal);
  };

  const totalDeals = Object.values(dealsByStage).reduce((sum, deals) => sum + deals.length, 0);
  const totalValue = Object.values(dealsByStage).reduce(
    (sum, deals) => sum + deals.reduce((s, d) => s + (d.deal_value || 0), 0),
    0
  );

  const formatValue = (value: number) => {
    if (value >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `€${(value / 1000).toFixed(0)}K`;
    return `€${value}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background px-4 md:px-6 py-4">
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">Deals</h1>
            <p className="text-sm text-muted-foreground">
              {totalDeals} deals · {formatValue(totalValue)} total value
            </p>
          </div>
          <Button onClick={() => handleAddDeal()} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Deal
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          {/* Pipeline Selector */}
          <Select
            value={activePipelineId}
            onValueChange={setSelectedPipelineId}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelines?.map((pipeline) => (
                <SelectItem key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative flex-1 min-w-0 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Press Enter to search..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(localSearch)}
              className="pl-9"
            />
          </div>

          {/* View Mode Toggles */}
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className="h-8 w-8 p-0"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-8 w-8 p-0"
            >
              <Table className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "forecast" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("forecast")}
              className="h-8 w-8 p-0"
            >
              <TrendingUp className="h-4 w-4" />
            </Button>
          </div>

          {/* Filters */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                All open
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>All open</DropdownMenuItem>
              <DropdownMenuItem>My deals</DropdownMenuItem>
              <DropdownMenuItem>Stale deals</DropdownMenuItem>
              <DropdownMenuItem>Won this month</DropdownMenuItem>
              <DropdownMenuItem>Lost this month</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                Sort by
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Created date</DropdownMenuItem>
              <DropdownMenuItem>Deal value</DropdownMenuItem>
              <DropdownMenuItem>Expected close</DropdownMenuItem>
              <DropdownMenuItem>Last activity</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {(pipelinesLoading || dealsLoading) ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : viewMode === "kanban" && stages ? (
          <PipelineBoard
            stages={stages}
            dealsByStage={dealsByStage}
            onDealClick={handleDealClick}
            onAddDeal={handleAddDeal}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {viewMode} view coming soon
          </div>
        )}
      </div>

      {/* Add Deal Modal */}
      <AddDealModal
        open={addDealOpen}
        onOpenChange={setAddDealOpen}
        initialStage={addDealInitialStage}
        initialData={{ pipeline_id: activePipelineId }}
      />

      {/* Deal Detail Sheet */}
      <Sheet open={!!selectedDeal} onOpenChange={(open) => !open && setSelectedDeal(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>{selectedDeal?.deal_name}</SheetTitle>
          </SheetHeader>
          
          {selectedDeal && (
            <Tabs defaultValue="details" className="mt-6">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="activities">Activities</TabsTrigger>
                <TabsTrigger value="emails">Emails</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Value</p>
                    <p className="font-medium">€{selectedDeal.deal_value?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Stage</p>
                    <p className="font-medium">{selectedDeal.stage}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Probability</p>
                    <p className="font-medium">{selectedDeal.probability}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Close</p>
                    <p className="font-medium">
                      {selectedDeal.expected_close_date 
                        ? new Date(selectedDeal.expected_close_date).toLocaleDateString() 
                        : "Not set"}
                    </p>
                  </div>
                </div>
                
                {selectedDeal.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm">{selectedDeal.notes}</p>
                  </div>
                )}
                
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedDeal(null);
                      setAddDealOpen(true);
                    }}
                  >
                    Edit Deal
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="activities">
                <p className="text-muted-foreground text-sm py-8 text-center">
                  No activities yet
                </p>
              </TabsContent>
              
              <TabsContent value="emails">
                <p className="text-muted-foreground text-sm py-8 text-center">
                  No emails linked
                </p>
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
