import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Building2, Users } from "lucide-react";
import { CustomersTab } from "@/components/customers/CustomersTab";
import { OrganisationsTab } from "@/components/customers/OrganisationsTab";
import { ImportDataButton } from "@/components/customers/ImportDataButton";

export default function Customers() {
  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            Manage and view all your customers and organisations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportDataButton />
          <Button className="w-full sm:w-auto">
            <UserPlus className="mr-2 h-4 w-4" />
            Add New
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="organisations" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="customers" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Customers
              </TabsTrigger>
              <TabsTrigger value="organisations" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Organisations
              </TabsTrigger>
            </TabsList>

            <TabsContent value="customers" className="mt-6">
              <CustomersTab />
            </TabsContent>

            <TabsContent value="organisations" className="mt-6">
              <OrganisationsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
