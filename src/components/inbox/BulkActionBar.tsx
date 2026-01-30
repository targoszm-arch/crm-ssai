import { Mail, MailOpen, Archive, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BulkActionBarProps {
  selectedCount: number;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onArchive: () => void;
  onClearSelection: () => void;
  isLoading?: boolean;
}

export function BulkActionBar({
  selectedCount,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onClearSelection,
  isLoading,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background p-2 shadow-lg">
      <span className="text-sm font-medium px-2">
        {selectedCount} selected
      </span>
      
      <div className="h-4 w-px bg-border" />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onMarkRead}
        disabled={isLoading}
        className="gap-1.5"
      >
        <MailOpen className="h-4 w-4" />
        Mark Read
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onMarkUnread}
        disabled={isLoading}
        className="gap-1.5"
      >
        <Mail className="h-4 w-4" />
        Mark Unread
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onArchive}
        disabled={isLoading}
        className="gap-1.5"
      >
        <Archive className="h-4 w-4" />
        Archive
      </Button>
      
      <div className="h-4 w-px bg-border" />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="gap-1.5"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
