import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus, Building2, Loader2 } from "lucide-react";
import { useCreateContact } from "@/hooks/useContacts";
import { useCompanies, useCreateCompany } from "@/hooks/useCompanies";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AddContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedCompanyId?: string;
  prefillData?: {
    first_name?: string;
    last_name?: string;
    title?: string;
    linkedin_url?: string;
    company_name?: string;
  };
  onSuccess?: (contactId: string) => void;
}

export function AddContactModal({ 
  open, 
  onOpenChange, 
  preselectedCompanyId,
  prefillData,
  onSuccess 
}: AddContactModalProps) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    title: "",
    work_location: "",
    notes: "",
    linkedin_url: "",
    company_id: preselectedCompanyId || "",
  });
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

  const { data: companies } = useCompanies({}, { column: "company_name", direction: "asc" });
  const createContact = useCreateContact();
  const createCompany = useCreateCompany();

  // Apply prefill data when modal opens
  useEffect(() => {
    if (open && prefillData) {
      setFormData((prev) => ({
        ...prev,
        first_name: prefillData.first_name || "",
        last_name: prefillData.last_name || "",
        title: prefillData.title || "",
        linkedin_url: prefillData.linkedin_url || "",
        company_id: preselectedCompanyId || "",
      }));
      // Set company search to prefilled company name for display
      if (prefillData.company_name) {
        setCompanySearch(prefillData.company_name);
      }
    }
  }, [open, prefillData, preselectedCompanyId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        title: "",
        work_location: "",
        notes: "",
        linkedin_url: "",
        company_id: "",
      });
      setCompanySearch("");
    }
  }, [open]);

  const selectedCompany = companies?.find((c) => c.id === formData.company_id);

  const filteredCompanies = companies?.filter((company) =>
    company.company_name.toLowerCase().includes(companySearch.toLowerCase())
  ) || [];

  const handleCreateCompany = async () => {
    if (!companySearch.trim()) return;

    setIsCreatingCompany(true);
    try {
      const newCompany = await createCompany.mutateAsync({
        company_name: companySearch.trim(),
      });
      setFormData((prev) => ({ ...prev, company_id: newCompany.id }));
      setCompanyOpen(false);
      toast.success(`Organisation "${newCompany.company_name}" created`);
    } catch (error) {
      toast.error("Failed to create organisation");
      console.error("Error creating company:", error);
    } finally {
      setIsCreatingCompany(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.first_name.trim()) {
      toast.error("First name is required");
      return;
    }

    try {
      const newContact = await createContact.mutateAsync({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        title: formData.title.trim() || null,
        work_location: formData.work_location.trim() || null,
        notes: formData.notes.trim() || null,
        linkedin_url: formData.linkedin_url.trim() || null,
        company_id: formData.company_id || null,
      });

      toast.success("Contact created successfully");
      onOpenChange(false);
      onSuccess?.(newContact.id);
    } catch (error) {
      toast.error("Failed to create contact");
      console.error("Error creating contact:", error);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const showCreateOption = companySearch.trim() && 
    !filteredCompanies.some(c => c.company_name.toLowerCase() === companySearch.toLowerCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => handleChange("first_name", e.target.value)}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => handleChange("last_name", e.target.value)}
                placeholder="Smith"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="john@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+1 555-0123"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Organisation</Label>
            <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={companyOpen}
                  className="w-full justify-between"
                >
                  {selectedCompany ? (
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {selectedCompany.company_name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Select or create organisation...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Search or type to create..." 
                    value={companySearch}
                    onValueChange={setCompanySearch}
                  />
                  <CommandList>
                    <CommandEmpty className="py-2 px-3 text-sm text-muted-foreground">
                      No organisation found.
                    </CommandEmpty>
                    {showCreateOption && (
                      <CommandGroup heading="Create New">
                        <CommandItem
                          onSelect={handleCreateCompany}
                          disabled={isCreatingCompany}
                          className="cursor-pointer"
                        >
                          {isCreatingCompany ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="mr-2 h-4 w-4" />
                          )}
                          Create "{companySearch.trim()}"
                        </CommandItem>
                      </CommandGroup>
                    )}
                    {filteredCompanies.length > 0 && (
                      <CommandGroup heading="Existing Organisations">
                        {filteredCompanies.map((company) => (
                          <CommandItem
                            key={company.id}
                            value={company.id}
                            onSelect={() => {
                              handleChange("company_id", company.id);
                              setCompanyOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.company_id === company.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                            {company.company_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Job Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Software Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work_location">Work Location</Label>
              <Input
                id="work_location"
                value={formData.work_location}
                onChange={(e) => handleChange("work_location", e.target.value)}
                placeholder="San Francisco, CA"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedin_url">LinkedIn URL</Label>
            <Input
              id="linkedin_url"
              value={formData.linkedin_url}
              onChange={(e) => handleChange("linkedin_url", e.target.value)}
              placeholder="https://linkedin.com/in/username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Additional notes about this contact..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createContact.isPending}>
              {createContact.isPending ? "Creating..." : "Create Contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
