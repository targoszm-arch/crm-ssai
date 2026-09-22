import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotesTab } from "./NotesTab";
import { EmailsTab } from "./EmailsTab";
import { DealsTab } from "./DealsTab";
import { LeadsTab } from "./LeadsTab";
import { EngagementTab } from "./EngagementTab";
import { LMSLeadsTab } from "./LMSLeadsTab";
import { FilesPanel } from "./FilesPanel";
import { ActivityStreamPanel } from "./ActivityStreamPanel";
import { Contact } from "@/hooks/useContacts";

interface ContactHistoryTabsProps {
  contact: Contact;
  manualNotes: string;
  isEditing: boolean;
  onNotesChange: (notes: string) => void;
  /** Opens the email an activity row describes, via the shared HistoryPanel. */
  onOpenEmail?: (emailId: string) => void;
}

export function ContactHistoryTabs({
  contact,
  manualNotes,
  isEditing,
  onNotesChange,
  onOpenEmail,
}: ContactHistoryTabsProps) {
  return (
    <Tabs defaultValue="activity" className="w-full">
      <TabsList className="w-full grid grid-cols-8 h-auto p-1">
        <TabsTrigger value="activity" className="text-xs px-2 py-1.5">Activity</TabsTrigger>
        <TabsTrigger value="notes" className="text-xs px-2 py-1.5">Notes</TabsTrigger>
        <TabsTrigger value="emails" className="text-xs px-2 py-1.5">Emails</TabsTrigger>
        <TabsTrigger value="engagement" className="text-xs px-2 py-1.5">Engagement</TabsTrigger>
        <TabsTrigger value="deals" className="text-xs px-2 py-1.5">Deals</TabsTrigger>
        <TabsTrigger value="leads" className="text-xs px-2 py-1.5">Leads</TabsTrigger>
        <TabsTrigger value="lms" className="text-xs px-2 py-1.5">LMS</TabsTrigger>
        <TabsTrigger value="files" className="text-xs px-2 py-1.5">Files</TabsTrigger>
      </TabsList>

      {/* Was two tabs (All, Activities) plus a separate page-level "Activity" tab
          outside this strip — three places to look for the same thing. This one
          panel already covers all of it: notes, meetings, emails and LinkedIn
          touches in one chronological feed, with the same deeplinks. */}
      <TabsContent value="activity" className="mt-4">
        <ActivityStreamPanel
          scope={{ contactId: contact.id, companyId: contact.company_id }}
          onOpenEmail={onOpenEmail}
          linkedinUrl={contact.linkedin_url}
        />
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

      <TabsContent value="files" className="mt-4">
        <FilesPanel scope={{ contactId: contact.id, companyId: contact.company_id }} />
      </TabsContent>
    </Tabs>
  );
}
