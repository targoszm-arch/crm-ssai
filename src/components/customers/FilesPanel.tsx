import { useRef, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText, FileSpreadsheet, Presentation, FileImage, File as FileIcon,
  Upload, Loader2, Trash2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCrmFiles, useUploadCrmFile, useDeleteCrmFile, crmFileUrl,
  type CrmFile, type FileScope,
} from "@/hooks/useCrmFiles";

/** Icon by what the file actually is, so a list of six is scannable. */
function iconFor(mime: string | null, name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mime?.includes("pdf") || ext === "pdf") return FileText;
  if (mime?.includes("sheet") || ["xlsx", "xls", "csv"].includes(ext)) return FileSpreadsheet;
  if (mime?.includes("presentation") || ["pptx", "ppt"].includes(ext)) return Presentation;
  if (mime?.startsWith("image/")) return FileImage;
  if (mime?.includes("word") || ["docx", "doc"].includes(ext)) return FileText;
  return FileIcon;
}

function readableSize(bytes: number | null): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

interface FilesPanelProps {
  scope: FileScope;
  /** The company view names the person a file came from; the person view need not. */
  showPerson?: boolean;
}

export function FilesPanel({ scope, showPerson = false }: FilesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const { data: files, isLoading } = useCrmFiles(scope);
  const upload = useUploadCrmFile();
  const remove = useDeleteCrmFile();

  const send = (list: FileList | null) => {
    if (!list?.length) return;
    for (const file of Array.from(list)) {
      upload.mutate(
        { file, scope },
        {
          onSuccess: () => toast.success(`${file.name} uploaded`),
          onError: (error) =>
            toast.error(
              `Could not upload ${file.name}: ` +
                (error instanceof Error ? error.message : "Unknown error"),
            ),
        },
      );
    }
  };

  const open = async (file: CrmFile) => {
    try {
      // Signed rather than public: these are customer documents.
      window.open(await crmFileUrl(file.path), "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the file");
    }
  };

  return (
    <div className="space-y-4">
      <Card
        className={dragging ? "border-primary bg-primary/5" : undefined}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); send(e.dataTransfer.files); }}
      >
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">Drop files here, or choose them</p>
            <p className="text-xs text-muted-foreground">
              PDF, Word, PowerPoint, Excel, images. Up to 25&nbsp;MB each.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { send(e.target.files); e.target.value = ""; }}
          />
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
            {upload.isPending
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Upload className="mr-1.5 h-3.5 w-3.5" />}
            Upload
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading files…
        </div>
      ) : !files?.length ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center">
          <FileIcon className="mx-auto size-8 text-muted-foreground/60" />
          <h3 className="mt-3 font-medium">No files yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {showPerson
              ? "Anything filed here or against one of their people will show up."
              : "Anything filed here will also show on their company."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="divide-y">
            {files.map((file) => {
              const Icon = iconFor(file.mime_type, file.name);
              const person = [file.contacts?.first_name, file.contacts?.last_name]
                .filter(Boolean).join(" ");
              return (
                <div key={file.id} className="group flex items-center gap-3 px-4 py-3">
                  <Icon className="size-5 shrink-0 text-muted-foreground" />
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => open(file)}
                  >
                    <span className="block truncate font-medium hover:text-primary hover:underline">
                      {file.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(file.created_at), "d MMM yyyy")}
                      {file.size_bytes ? ` · ${readableSize(file.size_bytes)}` : ""}
                      {showPerson && person ? ` · via ${person}` : ""}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Open ${file.name}`}
                    onClick={() => open(file)}
                  >
                    <ExternalLink className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={`Delete ${file.name}`}
                    onClick={() => remove.mutate(file)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
