import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Building2, Users, GraduationCap } from "lucide-react";
import { CustomersTab } from "@/components/customers/CustomersTab";
import { OrganisationsTab } from "@/components/customers/OrganisationsTab";
import { ExternalLMSLeadsTab } from "@/components/customers/ExternalLMSLeadsTab";
import { ImportDataButton } from "@/components/customers/ImportDataButton";
import { AddContactModal } from "@/components/customers/AddContactModal";

export default function Customers() {
  const [addContactOpen, setAddContactOpen] = useState(false);

  return (
    <div className="w-full px-4 py-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            Manage and view all your customers and organisations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportDataButton />
          <Button className="w-full sm:w-auto" onClick={() => setAddContactOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="organisations" className="w-full">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
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
          </Tabs>
        </CardContent>
      </Card>

      <AddContactModal
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
      />
    </div>
  );
}