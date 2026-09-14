import { useEffect, useState } from "react";
import { BookOpen, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type PipelineStage, useUpdatePipelineStage } from "@/hooks/usePipelines";

interface StageWikiSheetProps {
  stage: PipelineStage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StageWikiSheet({ stage, open, onOpenChange }: StageWikiSheetProps) {
  const [content, setContent] = useState("");
  const updateStage = useUpdatePipelineStage();

  useEffect(() => {
    setContent(stage?.wiki_content ?? "");
  }, [stage?.id, stage?.wiki_content]);

  const isDirty = content !== (stage?.wiki_content ?? "");

  const save = () => {
    if (!stage || !isDirty) return;
    updateStage.mutate(
      { id: stage.id, wiki_content: content },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader className="pr-8">
          <div className="flex items-center gap-2 text-primary">
            <BookOpen className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Stage wiki</span>
          </div>
          <SheetTitle>{stage?.name ?? "Stage notes"}</SheetTitle>
          <SheetDescription>
            Document the steps, requirements, and handoff notes needed to complete this stage.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex min-h-0 flex-1 flex-col gap-2">
          <label htmlFor="stage-wiki" className="text-sm font-medium">Playbook and notes</label>
          <Textarea
            id="stage-wiki"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Example:\n\n## Exit criteria\n- Confirm the buyer's needs\n- Agree on the next step\n\n## Helpful notes"
            className="min-h-[360px] flex-1 resize-none font-mono text-sm leading-6"
          />
          <p className="text-xs text-muted-foreground">Tip: use headings, checklists, and links to build a reusable stage playbook.</p>
        </div>

        <SheetFooter className="mt-6 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!isDirty || updateStage.isPending}>
            {updateStage.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save page
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
