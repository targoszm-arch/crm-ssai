import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Company } from "@/hooks/useCompanies";
import { useAiFieldDefinitions, useAiFieldValues, useScoreCompanyAi } from "@/hooks/useAiFields";

const TIER_CLASSES: Record<string, string> = {
  bronze: "border-amber-700/40 bg-amber-700/10 text-amber-800 dark:text-amber-400",
  silver: "border-slate-400/40 bg-slate-400/10 text-slate-600 dark:text-slate-300",
  gold: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  platinum: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-400",
};

/**
 * AI-configurable scoring: each "AI field" (Settings > AI Fields) pairs a criteria/rubric
 * prompt with either a tier label (e.g. Fit Score: Bronze/Silver/Gold/Platinum) or a
 * Qualified/Not Qualified signal claim with quoted evidence. "Score with AI" sends the
 * company's current data through every active field in one pass; results are cached in
 * ai_field_values until re-run, since these (especially hiring/funding/M&A signals) go
 * stale within a quarter.
 */
export function AiFieldsCard({ company }: { company: Company }) {
  const { data: definitions, isLoading: definitionsLoading } = useAiFieldDefinitions("company");
  const { data: values, isLoading: valuesLoading } = useAiFieldValues(company.id);
  const scoreWithAi = useScoreCompanyAi();

  const activeDefinitions = useMemo(
    () => (definitions ?? []).filter((d) => d.active),
    [definitions]
  );

  const valueByDefinitionId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof values>[number]>();
    for (const v of values ?? []) map.set(v.ai_field_definition_id, v);
    return map;
  }, [values]);

  const tierFields = activeDefinitions.filter((d) => d.kind === "tier");
  const qualifierFields = activeDefinitions.filter((d) => d.kind === "qualifier");

  const handleScore = () => {
    scoreWithAi.mutate(company.id, {
      onSuccess: (results) => toast.success(`Scored ${results.length} AI field${results.length !== 1 ? "s" : ""}`),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to score with AI"),
    });
  };

  if (definitionsLoading || valuesLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-5 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (activeDefinitions.length === 0) {
    return null;
  }

  const mostRecent = (values ?? [])
    .map((v) => v.computed_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">AI Signals</CardTitle>
        <Button size="sm" variant="outline" onClick={handleScore} disabled={scoreWithAi.isPending}>
          {scoreWithAi.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          Score with AI
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        {mostRecent && (
          <p className="text-xs text-muted-foreground">
            Last scored {formatDistanceToNow(new Date(mostRecent), { addSuffix: true })} -- re-run periodically, hiring/funding/audit signals go stale.
          </p>
        )}

        {tierFields.map((def) => {
          const value = valueByDefinitionId.get(def.id);
          return (
            <div key={def.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{def.label}</span>
                {value?.value ? (
                  <Badge variant="outline" className={cn("capitalize", TIER_CLASSES[value.value.toLowerCase()])}>
                    {value.value}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not scored</Badge>
                )}
              </div>
              {value?.evidence && (
                <p className="text-xs text-muted-foreground">{value.evidence}</p>
              )}
            </div>
          );
        })}

        {qualifierFields.length > 0 && (
          <div className="space-y-2.5 border-t pt-3">
            {qualifierFields.map((def) => {
              const value = valueByDefinitionId.get(def.id);
              const qualified = value?.value === "Qualified";
              return (
                <div key={def.id} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    {value?.value ? (
                      qualified ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-dashed" />
                    )}
                    <span className="text-sm">{def.label}</span>
                  </div>
                  {value?.evidence && (
                    <p className="pl-5 text-xs text-muted-foreground">"{value.evidence}"</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
