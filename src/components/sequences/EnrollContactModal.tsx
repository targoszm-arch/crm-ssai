import { useState, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Search, User, Mail, Loader2, GraduationCap, Building2, CheckCircle2 } from "lucide-react";
import { useContacts } from "@/hooks/useContacts";
import { Sequence, useEnrollContact } from "@/hooks/useSequences";
import { useExternalLMSCustomers, ExternalLMSCustomer } from "@/hooks/useExternalLMSCustomers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EnrollContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence: Sequence | null;
}

export function EnrollContactModal({ open, onOpenChange, sequence }: EnrollContactModalProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"crm" | "lms">("crm");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedLMSIds, setSelectedLMSIds] = useState<string[]>([]);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollProgress, setEnrollProgress] = useState(0);
  
  const { data: contacts, isLoading: contactsLoading } = useContacts();
  const { data: lmsCustomers, isLoading: lmsLoading } = useExternalLMSCustomers();
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

  const filteredLMSCustomers = useMemo(() => {
    if (!lmsCustomers) return [];
    if (!search) return lmsCustomers;
    const searchLower = search.toLowerCase();
    return lmsCustomers.filter(c => 
      c.full_name?.toLowerCase().includes(searchLower) ||
      c.email?.toLowerCase().includes(searchLower) ||
      c.role?.toLowerCase().includes(searchLower) ||
      c.company_size?.toLowerCase().includes(searchLower)
    );
  }, [lmsCustomers, search]);

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const toggleLMSCustomer = (customerId: string) => {
    setSelectedLMSIds((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleEnroll = async () => {
    if (!sequence) return;
    setIsEnrolling(true);
    setEnrollProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Enroll CRM contacts
      const totalItems = selectedContactIds.length + selectedLMSIds.length;
      let completed = 0;

      for (const contactId of selectedContactIds) {
        await enrollContact.mutateAsync({
          sequenceId: sequence.id,
          contactId,
        });
        completed++;
        setEnrollProgress(Math.round((completed / totalItems) * 100));
      }

      // Enroll LMS customers (create contact if needed)
      for (const lmsId of selectedLMSIds) {
        const lmsCustomer = lmsCustomers?.find(c => c.id === lmsId);
        if (!lmsCustomer?.email) continue;

        // Check if contact exists
        const { data: existingContact } = await supabase
          .from("contacts")
          .select("id")
          .eq("email", lmsCustomer.email)
          .eq("user_id", user.id)
          .maybeSingle();

        let contactId: string;

        if (existingContact) {
          contactId = existingContact.id;
        } else {
          // Create new contact with LMS Lead label
          const nameParts = lmsCustomer.full_name?.split(" ") || ["Unknown"];
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(" ") || null;

          const { data: newContact, error: createError } = await supabase
            .from("contacts")
            .insert({
              first_name: firstName,
              last_name: lastName,
              email: lmsCustomer.email,
              labels: "LMS Lead",
              notes: `Imported from LMS. Role: ${lmsCustomer.role || "N/A"}, Plan: ${lmsCustomer.plan || "N/A"}`,
              user_id: user.id,
            })
            .select("id")
            .single();

          if (createError) throw createError;
          contactId = newContact.id;

          // Log activity
          await supabase.from("activities").insert({
            contact_id: contactId,
            activity_type: "contact_created",
            description: `Contact created from LMS customer for sequence enrollment`,
            source: "lms_enrollment",
            user_id: user.id,
          });
        }

        // Enroll in sequence
        await enrollContact.mutateAsync({
          sequenceId: sequence.id,
          contactId,
          metadata: { source: "lms_enrollment", lms_email: lmsCustomer.email },
        });

        completed++;
        setEnrollProgress(Math.round((completed / totalItems) * 100));
      }

      // Trigger immediate processing for day 0 steps
      const firstStepDay = sequence.steps?.[0]?.day;
      if (firstStepDay === 0 || firstStepDay === undefined) {
        supabase.functions.invoke("process-sequences").catch(console.error);
      }

      toast.success(`Successfully enrolled ${totalItems} contact${totalItems !== 1 ? "s" : ""}`);
      handleClose();
    } catch (error: any) {
      console.error("Enrollment error:", error);
      toast.error(error.message || "Failed to enroll contacts");
    } finally {
      setIsEnrolling(false);
      setEnrollProgress(0);
    }
  };

  const handleClose = () => {
    setSelectedContactIds([]);
    setSelectedLMSIds([]);
    setSearch("");
    setActiveTab("crm");
    onOpenChange(false);
  };

  const getInitials = (firstName: string, lastName?: string | null) => {
    return `${firstName.charAt(0)}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const totalSelected = selectedContactIds.length + selectedLMSIds.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "crm" | "lms")}>
          <TabsList className="w-full">
            <TabsTrigger value="crm" className="flex-1">
              CRM Contacts ({contacts?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="lms" className="flex-1">
              LMS Customers ({lmsCustomers?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={activeTab === "crm" ? "Search contacts..." : "Search LMS customers..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* CRM Contacts Tab */}
          <TabsContent value="crm" className="mt-0">
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
          </TabsContent>

          {/* LMS Customers Tab */}
          <TabsContent value="lms" className="mt-0">
            <ScrollArea className="h-[300px] border rounded-lg">
              {lmsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLMSCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <GraduationCap className="h-8 w-8 mb-2" />
                  <p className="text-sm">No LMS customers found</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredLMSCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                      onClick={() => toggleLMSCustomer(customer.id)}
                    >
                      <Checkbox
                        checked={selectedLMSIds.includes(customer.id)}
                        onCheckedChange={() => toggleLMSCustomer(customer.id)}
                      />
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <GraduationCap className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {customer.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {customer.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {customer.company_size && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {customer.company_size}
                          </span>
                        )}
                        {customer.plan && (
                          <Badge variant="secondary" className="text-xs">
                            {customer.plan}
                          </Badge>
                        )}
                        {customer.verified && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Selected Count & Progress */}
        {totalSelected > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {totalSelected} contact{totalSelected !== 1 ? "s" : ""} selected
              {selectedContactIds.length > 0 && selectedLMSIds.length > 0 && (
                <span className="text-xs ml-1">
                  ({selectedContactIds.length} CRM, {selectedLMSIds.length} LMS)
                </span>
              )}
            </p>
            {isEnrolling && (
              <Progress value={enrollProgress} className="h-2" />
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isEnrolling}>
            Cancel
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={totalSelected === 0 || isEnrolling}
          >
            {isEnrolling ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Enroll {totalSelected > 0 ? `(${totalSelected})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
