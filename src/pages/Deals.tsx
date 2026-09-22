import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, LayoutGrid, List, Table, TrendingUp, Settings, ChevronDown, Building2, User, ArrowUpRight, Trash2 } from "lucide-react";
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
import { usePipelines, usePipelineStages, type PipelineStage } from "@/hooks/usePipelines";
import { useDealsByStage, useDeal, useDeleteDeal, Deal } from "@/hooks/useDeals";
import { PipelineBoard } from "@/components/deals/PipelineBoard";
import { AddDealModal } from "@/components/deals/AddDealModal";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageActions } from "@/components/layout/PageActions";
import { StageWikiSheet } from "@/components/deals/StageWikiSheet";
import PageShell from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";

type ViewMode = "kanban" | "list" | "table" | "forecast";

export default function Deals() {
  const [search, setSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | undefined>(searchParams.get("pipeline") || undefined);
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [addDealInitialStage, setAddDealInitialStage] = useState<string | undefined>();
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [wikiStage, setWikiStage] = useState<PipelineStage | null>(null);

  // ?deal=<id> opens that deal, so a "Linked deals" row on a person or a
  // company can point at the deal itself rather than the top of the board.
  const deepLinkedDealId = searchParams.get("deal") || undefined;
  const { data: deepLinkedDeal } = useDeal(deepLinkedDealId);

  const deleteDeal = useDeleteDeal();

  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const activePipelineId = selectedPipelineId || pipelines?.find(p => p.is_default)?.id || pipelines?.[0]?.id;
  const { data: stages } = usePipelineStages(activePipelineId);
  const { dealsByStage, isLoading: dealsLoading } = useDealsByStage(activePipelineId);

  const activePipeline = pipelines?.find(p => p.id === activePipelineId);

  const handleAddDeal = (stage?: string) => {
    setEditingDeal(null);
    setAddDealInitialStage(stage);
    setAddDealOpen(true);
  };

  useEffect(() => {
    if (deepLinkedDeal) setSelectedDeal(deepLinkedDeal);
  }, [deepLinkedDeal]);

  const handleDealClick = (deal: Deal) => {
    setSelectedDeal(deal);
  };

  const closeDealDetail = () => {
    setSelectedDeal(null);
    if (!deepLinkedDealId) return;
    // Leave the param behind, or reopening the sheet after closing it is
    // impossible without editing the URL.
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("deal");
    setSearchParams(nextParams, { replace: true });
  };

  const handleDeleteDeal = (deal: Deal) => {
    // deals.id has NO ACTION foreign keys from emails.deal_id, so a deal with a
    // linked email fails loudly on delete rather than silently orphaning the
    // email — that shows up as the raw Postgres error in the toast below.
    const confirmed = window.confirm(
      `Delete "${deal.deal_name}"? This permanently removes the deal — it cannot be undone.`
    );
    if (!confirmed) return;
    deleteDeal.mutate(deal.id, {
      onSuccess: () => closeDealDetail(),
    });
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
    <PageShell variant="fill">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <PageActions>
          <Button size="sm" onClick={() => handleAddDeal()} className="gap-2">
            <Plus className="h-4 w-4" />
            New deal
          </Button>
        </PageActions>

        <PageHeader
          title="Deals"
          description={`${totalDeals} deals · ${formatValue(totalValue)} total value`}
        />

        <div className="flex flex-col gap-3 rounded-lg border bg-card px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Pipeline Selector */}
          <Select
            value={activePipelineId}
            onValueChange={(value) => {
              setSelectedPipelineId(value);
              const nextParams = new URLSearchParams(searchParams);
              nextParams.set("pipeline", value);
              setSearchParams(nextParams, { replace: true });
            }}
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
            onStageClick={setWikiStage}
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
        onOpenChange={(open) => {
          setAddDealOpen(open);
          if (!open) setEditingDeal(null);
        }}
        initialStage={addDealInitialStage}
        // Without the deal itself the modal has no id to branch on, so it opened
        // in create mode however you got there — titled "Add Deal", submitting
        // through the insert path, and failing on the deals INSERT policy.
        initialData={editingDeal ?? { pipeline_id: activePipelineId }}
      />

      <StageWikiSheet
        stage={wikiStage}
        open={!!wikiStage}
        onOpenChange={(open) => !open && setWikiStage(null)}
      />

      {/* Deal Detail Sheet */}
      <Sheet open={!!selectedDeal} onOpenChange={(open) => !open && closeDealDetail()}>
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
                
                {/* The people the deal is about. Showing only the money and the
                    stage meant the sheet was a dead end: you knew a deal existed
                    and had no way to reach whoever it belongs to. */}
                <div className="space-y-2 border-t pt-4">
                  <p className="text-sm text-muted-foreground">Linked records</p>
                  {selectedDeal.contacts ? (
                    <Link
                      to={`/people/${selectedDeal.contacts.id}`}
                      className="flex items-center gap-2 text-sm font-medium hover:underline"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      {selectedDeal.contacts.first_name} {selectedDeal.contacts.last_name}
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground">No contact linked</p>
                  )}
                  {selectedDeal.companies ? (
                    <Link
                      to={`/companies/${selectedDeal.companies.id}`}
                      className="flex items-center gap-2 text-sm font-medium hover:underline"
                    >
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {selectedDeal.companies.company_name}
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground">No company linked</p>
                  )}
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
                      setEditingDeal(selectedDeal);
                      // A stage left over from "add in this column" would be
                      // reapplied on top of the deal's own stage.
                      setAddDealInitialStage(undefined);
                      setSelectedDeal(null);
                      setAddDealOpen(true);
                    }}
                  >
                    Edit Deal
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={deleteDeal.isPending}
                    onClick={() => handleDeleteDeal(selectedDeal)}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete
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
    </PageShell>
  );
}
