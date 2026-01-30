import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, User, Mail, Loader2 } from "lucide-react";
import { useContacts } from "@/hooks/useContacts";
import { Sequence, useEnrollContact } from "@/hooks/useSequences";

interface EnrollContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence: Sequence | null;
}

export function EnrollContactModal({ open, onOpenChange, sequence }: EnrollContactModalProps) {
  const [search, setSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const { data: contacts, isLoading: contactsLoading } = useContacts();
  const enrollContact = useEnrollContact();

  const filteredContacts = contacts?.filter((contact) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const fullName = `${contact.first_name} ${contact.last_name || ""}`.toLowerCase();
    return (
      fullName.includes(searchLower) ||
      contact.email?.toLowerCase().includes(searchLower)
    );
  });

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleEnroll = async () => {
    if (!sequence) return;

    for (const contactId of selectedContactIds) {
      await enrollContact.mutateAsync({
        sequenceId: sequence.id,
        contactId,
      });
    }

    setSelectedContactIds([]);
    setSearch("");
    onOpenChange(false);
  };

  const getInitials = (firstName: string, lastName?: string | null) => {
    return `${firstName.charAt(0)}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enroll Contacts</DialogTitle>
          <DialogDescription>
            Select contacts to enroll in "{sequence?.name}"
          </DialogDescription>
        </DialogHeader>

        {/* Sequence Preview */}
        {sequence && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{sequence.steps.length} emails</span>
              <Badge variant="outline" className="text-xs">
                {sequence.steps.length > 0
                  ? `${sequence.steps[sequence.steps.length - 1].day} days`
                  : "0 days"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {sequence.steps.slice(0, 2).map((step, i) => (
                <div key={i}>
                  Day {step.day}: {step.subject || "(No subject)"}
                </div>
              ))}
              {sequence.steps.length > 2 && (
                <div>+{sequence.steps.length - 2} more emails</div>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Contact List */}
        <ScrollArea className="h-[300px] border rounded-lg">
          {contactsLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContacts?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <User className="h-8 w-8 mb-2" />
              <p className="text-sm">No contacts found</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredContacts?.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                  onClick={() => toggleContact(contact.id)}
                >
                  <Checkbox
                    checked={selectedContactIds.includes(contact.id)}
                    onCheckedChange={() => toggleContact(contact.id)}
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={contact.avatar || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(contact.first_name, contact.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {contact.email || "No email"}
                    </p>
                  </div>
                  {contact.title && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {contact.title}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Selected Count */}
        {selectedContactIds.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {selectedContactIds.length} contact{selectedContactIds.length !== 1 ? "s" : ""} selected
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={selectedContactIds.length === 0 || enrollContact.isPending}
          >
            {enrollContact.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Enroll {selectedContactIds.length > 0 ? `(${selectedContactIds.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
