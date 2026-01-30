import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Mail,
} from "lucide-react";
import {
  useEmailTemplates,
  useDeleteTemplate,
  useDuplicateTemplate,
  EmailTemplate,
} from "@/hooks/useEmailTemplates";
import { EditTemplateSheet } from "./EditTemplateSheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TemplateListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate?: (template: EmailTemplate) => void;
  selectionMode?: boolean;
}

const categoryColors: Record<string, string> = {
  welcome: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  follow_up: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  sales: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  meeting: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  thank_you: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  newsletter: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  general: "bg-muted text-muted-foreground",
};

export function TemplateListModal({
  open,
  onOpenChange,
  onSelectTemplate,
  selectionMode = false,
}: TemplateListModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);

  const { data: templates, isLoading } = useEmailTemplates();
  const deleteTemplate = useDeleteTemplate();
  const duplicateTemplate = useDuplicateTemplate();

  const filteredTemplates = templates?.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setEditorOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setEditorOpen(true);
  };

  const handleDuplicate = (template: EmailTemplate) => {
    duplicateTemplate.mutate(template.id);
  };

  const handleDeleteClick = (template: EmailTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (templateToDelete) {
      deleteTemplate.mutate(templateToDelete.id);
    }
    setDeleteDialogOpen(false);
    setTemplateToDelete(null);
  };

  const handleSelect = (template: EmailTemplate) => {
    if (selectionMode && onSelectTemplate) {
      onSelectTemplate(template);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectionMode ? "Select a Template" : "Email Templates"}
            </DialogTitle>
            <DialogDescription>
              {selectionMode
                ? "Choose a template to use for this email step."
                : "Manage your email templates for sequences."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4 py-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {!selectionMode && (
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredTemplates?.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No templates found</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  {searchQuery
                    ? "Try a different search term"
                    : "Create your first email template"}
                </p>
                {!selectionMode && (
                  <Button className="mt-4" onClick={handleCreateNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 pb-4">
                {filteredTemplates?.map((template) => (
                  <Card
                    key={template.id}
                    className={`hover:border-primary/50 transition-colors ${
                      selectionMode ? "cursor-pointer" : ""
                    }`}
                    onClick={() => selectionMode && handleSelect(template)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1 min-w-0">
                          <CardTitle className="text-base truncate">
                            {template.name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground truncate">
                            {template.subject || "No subject"}
                          </p>
                        </div>
                        {!selectionMode && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(template)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteClick(template)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            categoryColors[template.category || "general"] ||
                            categoryColors.general
                          }
                        >
                          {template.category || "general"}
                        </Badge>
                        {template.is_default && (
                          <Badge variant="outline" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      {template.body_html && (
                        <div
                          className="mt-3 text-xs text-muted-foreground line-clamp-2 prose prose-sm max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{
                            __html: template.body_html.slice(0, 150),
                          }}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <EditTemplateSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={selectedTemplate}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
