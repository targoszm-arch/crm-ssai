import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAiSenderProfile, useSaveAiSenderProfile } from "@/hooks/useAiFields";

/**
 * The "who's selling" context every AI Fit Score field is scored against -- offering,
 * ICP, pricing, differentiation, social proof. One free-text blob rather than structured
 * fields on purpose: it's meant to be pasted from wherever the canonical positioning doc
 * already lives, not re-typed into a form.
 */
export default function AiSenderProfileSettings() {
  const { data: profile, isLoading } = useAiSenderProfile();
  const save = useSaveAiSenderProfile();
  const [content, setContent] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    if (profile && profile.id !== loadedId) {
      setContent(profile.content);
      setLoadedId(profile.id);
    }
  }, [profile, loadedId]);

  const handleSave = () => {
    save.mutate(content, {
      onSuccess: () => toast.success("Company profile saved"),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Company Profile (for AI)</CardTitle>
        </div>
        <CardDescription>
          Your own company's offering, ICP and positioning -- attached automatically to every AI Fit Score
          field so the model knows what it's scoring fit against. Qualifier fields (Qualified / Not Qualified
          signals) don't use this; they only look at the prospect's own data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-5 pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <>
            <Textarea
              rows={16}
              className="font-mono text-xs"
              placeholder="Company name, offering, ICP, pricing, differentiation, social proof..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
