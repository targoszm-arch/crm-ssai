import { useState } from "react";
import { ListPlus, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLists, useCreateList, useAddToList } from "@/hooks/useLists";

interface AddToListMenuProps {
  contactIds?: string[];
  companyIds?: string[];
  disabled?: boolean;
}

export function AddToListMenu({ contactIds, companyIds, disabled }: AddToListMenuProps) {
  const [newListName, setNewListName] = useState("");
  const { data: lists, isLoading } = useLists();
  const createList = useCreateList();
  const addToList = useAddToList();

  const selectedCount = (contactIds?.length ?? 0) + (companyIds?.length ?? 0);

  const handleAdd = (listId: string) => {
    addToList.mutate({ listId, contactIds, companyIds });
  };

  const handleCreateAndAdd = async () => {
    const name = newListName.trim();
    if (!name) return;
    const list = await createList.mutateAsync({ name });
    setNewListName("");
    handleAdd(list.id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || selectedCount === 0}>
          {addToList.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <ListPlus className="h-4 w-4 mr-1" />
          )}
          Add to list
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Add {selectedCount} to…</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <DropdownMenuItem disabled>Loading lists…</DropdownMenuItem>
        ) : lists && lists.length > 0 ? (
          lists.map((list) => (
            <DropdownMenuItem key={list.id} onSelect={() => handleAdd(list.id)}>
              <span className="truncate">{list.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {list.contact_count + list.company_count}
              </span>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>No lists yet</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <div className="p-2 flex gap-1">
          <Input
            placeholder="New list name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            // Without this the dropdown's typeahead swallows the keystrokes and the
            // field stays empty while the menu jumps between items.
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") handleCreateAndAdd();
            }}
            className="h-8"
          />
          <Button
            size="sm"
            className="h-8 px-2"
            disabled={!newListName.trim() || createList.isPending}
            onClick={handleCreateAndAdd}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
