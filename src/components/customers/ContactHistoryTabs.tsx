import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotesTab } from "./NotesTab";
import { ActivitiesTab } from "./ActivitiesTab";
import { EmailsTab } from "./EmailsTab";
import { DealsTab } from "./DealsTab";
import { LeadsTab } from "./LeadsTab";
import { EngagementTab } from "./EngagementTab";
import { AllTab } from "./AllTab";
import { LMSLeadsTab } from "./LMSLeadsTab";
import { Contact } from "@/hooks/useContacts";

interface ContactHistoryTabsProps {
  contact: Contact;
  manualNotes: string;
  isEditing: boolean;
  onNotesChange: (notes: string) => void;
}

export function ContactHistoryTabs({ 
  contact, 
  manualNotes, 
  isEditing, 
  onNotesChange 
}: ContactHistoryTabsProps) {
  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="w-full grid grid-cols-8 h-auto p-1">
        <TabsTrigger value="all" className="text-xs px-2 py-1.5">All</TabsTrigger>
        <TabsTrigger value="activities" className="text-xs px-2 py-1.5">Activities</TabsTrigger>
        <TabsTrigger value="notes" className="text-xs px-2 py-1.5">Notes</TabsTrigger>
        <TabsTrigger value="emails" className="text-xs px-2 py-1.5">Emails</TabsTrigger>
        <TabsTrigger value="engagement" className="text-xs px-2 py-1.5">Engagement</TabsTrigger>
        <TabsTrigger value="deals" className="text-xs px-2 py-1.5">Deals</TabsTrigger>
        <TabsTrigger value="leads" className="text-xs px-2 py-1.5">Leads</TabsTrigger>
        <TabsTrigger value="lms" className="text-xs px-2 py-1.5">LMS</TabsTrigger>
      </TabsList>
      
      <TabsContent value="all" className="mt-4">
        <AllTab contact={contact} />
      </TabsContent>
      
      <TabsContent value="activities" className="mt-4">
        <ActivitiesTab contactId={contact.id} />
      </TabsContent>
      
      <TabsContent value="notes" className="mt-4">
        <NotesTab 
          contactId={contact.id} 
          manualNotes={manualNotes}
          isEditing={isEditing}
          onNotesChange={onNotesChange}
        />
      </TabsContent>
      
      <TabsContent value="emails" className="mt-4">
        <EmailsTab contactId={contact.id} />
      </TabsContent>
      
      <TabsContent value="engagement" className="mt-4">
        <EngagementTab contact={contact} />
      </TabsContent>
      
      <TabsContent value="deals" className="mt-4">
        <DealsTab contactId={contact.id} />
      </TabsContent>
      
      <TabsContent value="leads" className="mt-4">
        <LeadsTab contactId={contact.id} />
      </TabsContent>

      <TabsContent value="lms" className="mt-4">
        <LMSLeadsTab contactId={contact.id} contactEmail={contact.email} />
      </TabsContent>
    </Tabs>
  );
}
