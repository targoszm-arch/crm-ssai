
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  change?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function MetricCard({ 
  title, 
  value, 
  icon, 
  change, 
  className 
}: MetricCardProps) {
  return (
    <Card className={cn("hover-scale", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between space-y-0">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {title}
            </p>
            <div className="flex items-baseline mt-1 space-x-1">
              <p className="text-2xl font-bold">{value}</p>
              {change && (
                <p className={cn(
                  "text-xs font-medium flex items-center",
                  change.isPositive ? "text-green-600" : "text-red-600"
                )}>
                  {change.isPositive ? (
                    <ArrowUpIcon className="w-3 h-3 mr-0.5" />
                  ) : (
                    <ArrowDownIcon className="w-3 h-3 mr-0.5" />
                  )}
                  {Math.abs(change.value)}%
                </p>
              )}
            </div>
          </div>
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
