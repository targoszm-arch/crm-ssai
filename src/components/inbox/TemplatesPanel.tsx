import { useState, useMemo } from "react";
import { Settings } from "lucide-react";
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
          {/* Stacked rather than name-beside-button: a template name is a
              sentence, and sharing one line with an icon and a button left it
              with about a third of the panel and nothing but ellipsis. */}
          {featuredTemplates.map((template) => (
            <div
              key={template.id}
              className="rounded-md px-2 py-2 hover:bg-accent"
            >
              <p className="text-sm font-medium leading-snug">{template.name}</p>
              {template.subject && (
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                  {template.subject}
                </p>
              )}
              <div className="mt-1.5 flex justify-end">
                {/* Always visible. Hidden until hover, this was the only action
                    on the panel and looked like there wasn't one. */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => onUseTemplate(template)}
                >
                  Use
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateListModal
        open={manageOpen}
        onOpenChange={setManageOpen}
        onSelectTemplate={onUseTemplate}
      />
    </div>
  );
}
