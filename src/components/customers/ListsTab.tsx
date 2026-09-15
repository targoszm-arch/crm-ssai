import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Plus, Trash2, Users, Building2, ListIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  useLists,
  useListMembers,
  useCreateList,
  useDeleteList,
  useRemoveFromList,
} from "@/hooks/useLists";

export function ListsTab() {
  const [selectedListId, setSelectedListId] = useState<string | undefined>();
  const [newListName, setNewListName] = useState("");

  const { data: lists, isLoading } = useLists();
  const createList = useCreateList();
  const deleteList = useDeleteList();

  const activeListId = selectedListId ?? lists?.[0]?.id;
  const activeList = lists?.find((l) => l.id === activeListId);

  const handleCreate = async () => {
    const name = newListName.trim();
    if (!name) return;
    const list = await createList.mutateAsync({ name });
    setNewListName("");
    setSelectedListId(list.id);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Lists */}
      <div className="w-full lg:w-72 shrink-0 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="New list name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button
            onClick={handleCreate}
            disabled={!newListName.trim() || createList.isPending}
            size="icon"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {!lists || lists.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <ListIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No lists yet. Create one above, then add people from the Customers
              tab or companies from Organisations.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1">
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={cn(
                  "w-full rounded-md border p-3 text-left transition-colors hover:bg-accent",
                  list.id === activeListId && "bg-accent border-primary"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{list.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {list.contact_count + list.company_count}
                  </span>
                </div>
                <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                  {list.contact_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {list.contact_count}
                    </span>
                  )}
                  {list.company_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {list.company_count}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Members */}
      <div className="flex-1 min-w-0">
        {activeList ? (
          <ListMembers
            listId={activeList.id}
            listName={activeList.name}
            onDelete={() => {
              deleteList.mutate(activeList.id);
              setSelectedListId(undefined);
            }}
            isDeleting={deleteList.isPending}
          />
        ) : null}
      </div>
    </div>
  );
}

function ListMembers({
  listId,
  listName,
  onDelete,
  isDeleting,
}: {
  listId: string;
  listName: string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { data: members, isLoading } = useListMembers(listId);
  const removeFromList = useRemoveFromList();

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-medium">{listName}</h3>
            <p className="text-xs text-muted-foreground">
              {members?.length ?? 0} member{members?.length === 1 ? "" : "s"}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isDeleting}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete list
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{listName}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the list and its membership. The contacts and
                  companies themselves are not deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete list</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !members || members.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing on this list yet. Select people on the Customers tab or
            companies on Organisations, then use "Add to list".
          </p>
        ) : (
          <div className="divide-y rounded-md border">
            {members.map((member) => {
              const isContact = !!member.contact;
              const href = isContact
                ? `/people/${member.contact!.id}`
                : `/companies/${member.company!.id}`;
              const name = isContact
                ? [member.contact!.first_name, member.contact!.last_name]
                    .filter(Boolean)
                    .join(" ")
                : member.company!.company_name;
              const subtitle = isContact
                ? member.contact!.email ?? member.contact!.title
                : member.company!.domain ?? member.company!.industry;

              return (
                <div key={member.id} className="flex items-center gap-3 p-3">
                  <Badge variant="outline" className="shrink-0">
                    {isContact ? (
                      <Users className="h-3 w-3" />
                    ) : (
                      <Building2 className="h-3 w-3" />
                    )}
                  </Badge>
                  <Link to={href} className="min-w-0 flex-1 hover:underline">
                    <p className="truncate text-sm font-medium">{name}</p>
                    {subtitle && (
                      <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                    )}
                  </Link>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {formatDistanceToNow(new Date(member.added_at), { addSuffix: true })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() =>
                      removeFromList.mutate({ listId, memberIds: [member.id] })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
