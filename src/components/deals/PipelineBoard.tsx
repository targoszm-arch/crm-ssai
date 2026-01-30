import { useState, DragEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Deal, useMoveDealToStage } from "@/hooks/useDeals";
import { PipelineStage } from "@/hooks/usePipelines";
import { DealCard } from "./DealCard";

interface PipelineBoardProps {
  stages: PipelineStage[];
  dealsByStage: Record<string, Deal[]>;
  onDealClick: (deal: Deal) => void;
  onAddDeal: (stage?: string) => void;
}

export function PipelineBoard({
  stages,
  dealsByStage,
  onDealClick,
  onAddDeal,
}: PipelineBoardProps) {
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dropTargetStage, setDropTargetStage] = useState<string | null>(null);
  const moveDeal = useMoveDealToStage();

  const handleDragStart = (e: DragEvent, dealId: string) => {
    setDraggedDealId(dealId);
    e.dataTransfer.setData("dealId", dealId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent, stageName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetStage(stageName);
  };

  const handleDragLeave = () => {
    setDropTargetStage(null);
  };

  const handleDrop = (e: DragEvent, stageName: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("dealId");
    
    if (dealId) {
      moveDeal.mutate({ dealId, stage: stageName });
    }
    
    setDraggedDealId(null);
    setDropTargetStage(null);
  };

  const handleDragEnd = () => {
    setDraggedDealId(null);
    setDropTargetStage(null);
  };

  const getStageTotal = (stageName: string) => {
    const deals = dealsByStage[stageName] || [];
    return deals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0);
  };

  const formatTotal = (total: number) => {
    if (total >= 1000000) return `€${(total / 1000000).toFixed(1)}M`;
    if (total >= 1000) return `€${(total / 1000).toFixed(0)}K`;
    return `€${total}`;
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 p-4 min-w-max">
        {stages.map((stage) => {
          const stageDeals = dealsByStage[stage.name] || [];
          const stageTotal = getStageTotal(stage.name);
          const isDropTarget = dropTargetStage === stage.name;

          return (
            <div
              key={stage.id}
              className={cn(
                "w-72 shrink-0 rounded-lg bg-muted/50 transition-colors",
                isDropTarget && "bg-primary/10 ring-2 ring-primary/30"
              )}
              onDragOver={(e) => handleDragOver(e, stage.name)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.name)}
            >
              {/* Stage Header */}
              <div className="p-3 border-b bg-background/50 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <h3 className="font-medium text-sm">{stage.name}</h3>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {stageDeals.length}
                    </span>
                  </div>
                </div>
                {stageTotal > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTotal(stageTotal)}
                  </p>
                )}
              </div>

              {/* Stage Content */}
              <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, deal.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <DealCard
                      deal={deal}
                      onClick={() => onDealClick(deal)}
                      isDragging={draggedDealId === deal.id}
                    />
                  </div>
                ))}

                {stageDeals.length === 0 && (
                  <div className="h-24 flex items-center justify-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                    Drop deals here
                  </div>
                )}
              </div>

              {/* Add Deal Button */}
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-muted-foreground"
                  onClick={() => onAddDeal(stage.name)}
                >
                  <Plus className="h-4 w-4" />
                  Add deal
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
