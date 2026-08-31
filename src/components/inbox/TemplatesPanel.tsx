import { useState, useMemo } from "react";
import { FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmailTemplates, EmailTemplate } from "@/hooks/useEmailTemplates";
import { TemplateListModal } from "@/components/templates/TemplateListModal";

interface TemplatesPanelProps {
  onUseTemplate: (template: EmailTemplate) => void;
  /** How many templates to feature before "Manage" is needed for the rest. */
  limit?: number;
}

/**
 * Sidebar quick-access to the 3 most recently updated email templates, so
 * sending a familiar message doesn't require opening the composer's toolbar
 * template picker first.
 */
export function TemplatesPanel({ onUseTemplate, limit = 3 }: TemplatesPanelProps) {
  const { data: templates } = useEmailTemplates();
  const [manageOpen, setManageOpen] = useState(false);

  const featuredTemplates = useMemo(() => {
    return [...(templates || [])]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit);
  }, [templates, limit]);

  return (
    <div className="border-t p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Templates
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => setManageOpen(true)}
        >
          <Settings className="h-3 w-3 mr-1" />
          Manage
        </Button>
      </div>

      {featuredTemplates.length === 0 ? (
        <p className="text-xs text-muted-foreground">No templates saved yet.</p>
      ) : (
        <div className="space-y-1">
          {featuredTemplates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm truncate">{template.name}</p>
                  {template.subject && (
                    <p className="text-xs text-muted-foreground truncate">{template.subject}</p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onUseTemplate(template)}
              >
                Use
              </Button>
            </div>
          ))}
        </div>
      )}

      <TemplateListModal open={manageOpen} onOpenChange={setManageOpen} />
    </div>
  );
}
