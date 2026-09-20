import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Building2, Users, GraduationCap, List as ListIcon } from "lucide-react";
import { CustomersTab } from "@/components/customers/CustomersTab";
import { OrganisationsTab } from "@/components/customers/OrganisationsTab";
import { ListsTab } from "@/components/customers/ListsTab";
import { ExternalLMSLeadsTab } from "@/components/customers/ExternalLMSLeadsTab";
import { ImportDataButton } from "@/components/customers/ImportDataButton";
import { AddContactModal } from "@/components/customers/AddContactModal";
import { PageActions } from "@/components/layout/PageActions";
import { PageHeader } from "@/components/layout/PageHeader";
import PageShell from "@/components/layout/PageShell";

const VALID_TABS = ["customers", "organisations", "lms-leads", "lists"];

export default function Customers() {
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "organisations";

  return (
    <PageShell>
      <PageActions>
        <ImportDataButton />
        <Button size="sm" onClick={() => setAddContactOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add contact
        </Button>
      </PageActions>

      <PageHeader
        title="Customers"
        description="Manage and view all your customers and organisations."
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const nextParams = new URLSearchParams(searchParams);
          nextParams.set("tab", value);
          setSearchParams(nextParams, { replace: true });
        }}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Customers
          </TabsTrigger>
          <TabsTrigger value="organisations" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organisations
          </TabsTrigger>
          <TabsTrigger value="lms-leads" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            LMS Leads
          </TabsTrigger>
          <TabsTrigger value="lists" className="flex items-center gap-2">
            <ListIcon className="h-4 w-4" />
            Lists
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-6">
          <CustomersTab />
        </TabsContent>

        <TabsContent value="organisations" className="mt-6">
          <OrganisationsTab />
        </TabsContent>

        <TabsContent value="lms-leads" className="mt-6">
          <ExternalLMSLeadsTab />
        </TabsContent>

        <TabsContent value="lists" className="mt-6">
          <ListsTab />
        </TabsContent>
      </Tabs>

      <AddContactModal
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
      />
    </PageShell>
  );
}
