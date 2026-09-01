import { cn } from "@/lib/utils";
import { Inbox, Send, Archive, FileText, Clock } from "lucide-react";

export type EmailFolder = "inbox" | "drafts" | "outbox" | "sent" | "archive";

interface InboxSidebarProps {
  currentFolder: EmailFolder;
  onFolderChange: (folder: EmailFolder) => void;
  folderCounts?: Record<EmailFolder, number>;
  /** Icons only, labels moved to the title attribute. */
  collapsed?: boolean;
}

const folders: { id: EmailFolder; label: string; icon: React.ReactNode }[] = [
  { id: "inbox", label: "Inbox", icon: <Inbox className="h-4 w-4" /> },
  { id: "drafts", label: "Drafts", icon: <FileText className="h-4 w-4" /> },
  { id: "outbox", label: "Outbox", icon: <Clock className="h-4 w-4" /> },
  { id: "sent", label: "Sent", icon: <Send className="h-4 w-4" /> },
  { id: "archive", label: "Archive", icon: <Archive className="h-4 w-4" /> },
];

export function InboxSidebar({
  currentFolder,
  onFolderChange,
  folderCounts = { inbox: 0, drafts: 0, outbox: 0, sent: 0, archive: 0 },
  collapsed = false,
}: InboxSidebarProps) {
  return (
    <div className="w-full p-2">
      <div className="space-y-1">
        {folders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => onFolderChange(folder.id)}
            title={collapsed ? folder.label : undefined}
            className={cn(
              "flex w-full items-center rounded-md py-2 text-sm transition-colors",
              collapsed ? "justify-center px-0" : "justify-between px-3",
              currentFolder === folder.id
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              {folder.icon}
              {!collapsed && <span>{folder.label}</span>}
            </div>
            {!collapsed && folderCounts[folder.id] > 0 && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  currentFolder === folder.id
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted-foreground/20 text-muted-foreground"
                )}
              >
                {folderCounts[folder.id]}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
