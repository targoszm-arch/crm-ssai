import { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotesTab } from "./NotesTab";
import { EmailsTab } from "./EmailsTab";
import { LinkedDealsCard } from "@/components/deals/LinkedDealsCard";
import { LeadsTab } from "./LeadsTab";
import { EngagementTab } from "./EngagementTab";
import { LMSLeadsTab } from "./LMSLeadsTab";
import { FilesPanel } from "./FilesPanel";
import { ActivityStreamPanel } from "./ActivityStreamPanel";
import { Contact } from "@/hooks/useContacts";
import { Company } from "@/hooks/useCompanies";

interface ExtraTab {
  value: string;
  label: string;
  content: ReactNode;
}

interface EntityHistoryTabsProps {
  contact?: Contact;
  company?: Company;
  manualNotes?: string;
  isEditing?: boolean;
  onNotesChange?: (notes: string) => void;
  /** Opens the email an activity row describes, via the shared HistoryPanel. */
  onOpenEmail?: (emailId: string) => void;
  /** Company-only tabs (e.g. Employees) that don't apply to a contact, prepended to the strip. */
  extraTabs?: ExtraTab[];
}

/**
 * The 8-tab history strip -- Activity, Notes, Emails, Engagement, Deals,
 * Leads, LMS, Files -- shared by the contact and company detail pages so
 * they don't drift into two different sets of tabs for the same underlying
 * data (Magda: "THESE SHOULD BE IN COMPANIES AS WELL AS PEOPLE"). Every
 * child tab takes a `{ contactId?, companyId? }` scope and queries by
 * whichever one is set.
 */
export function EntityHistoryTabs({
  contact,
  company,
  manualNotes,
  isEditing,
  onNotesChange,
  onOpenEmail,
  extraTabs = [],
}: EntityHistoryTabsProps) {
  const scope = { contactId: contact?.id, companyId: company?.id };
  const columns = extraTabs.length + 8;

  return (
    <Tabs defaultValue={extraTabs[0]?.value ?? "activity"} className="w-full">
      <TabsList className="w-full h-auto p-1" style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {extraTabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="text-xs px-2 py-1.5">{tab.label}</TabsTrigger>
        ))}
        <TabsTrigger value="activity" className="text-xs px-2 py-1.5">Activity</TabsTrigger>
        <TabsTrigger value="notes" className="text-xs px-2 py-1.5">Notes</TabsTrigger>
        <TabsTrigger value="emails" className="text-xs px-2 py-1.5">Emails</TabsTrigger>
        <TabsTrigger value="engagement" className="text-xs px-2 py-1.5">Engagement</TabsTrigger>
        <TabsTrigger value="deals" className="text-xs px-2 py-1.5">Deals</TabsTrigger>
        <TabsTrigger value="leads" className="text-xs px-2 py-1.5">Leads</TabsTrigger>
        <TabsTrigger value="lms" className="text-xs px-2 py-1.5">LMS</TabsTrigger>
        <TabsTrigger value="files" className="text-xs px-2 py-1.5">Files</TabsTrigger>
      </TabsList>

      {extraTabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-4">
          {tab.content}
        </TabsContent>
      ))}

      <TabsContent value="activity" className="mt-4">
        <ActivityStreamPanel
          scope={scope}
          showPerson={!contact}
          onOpenEmail={onOpenEmail}
          linkedinUrl={contact?.linkedin_url ?? company?.linkedin_url}
        />
      </TabsContent>

      <TabsContent value="notes" className="mt-4">
        <NotesTab
          scope={scope}
          manualNotes={manualNotes}
          isEditing={isEditing}
          onNotesChange={onNotesChange}
        />
      </TabsContent>

      <TabsContent value="emails" className="mt-4">
        <EmailsTab scope={scope} />
      </TabsContent>

      <TabsContent value="engagement" className="mt-4">
        <EngagementTab contact={contact} company={company} />
      </TabsContent>

      <TabsContent value="deals" className="mt-4">
        <LinkedDealsCard
          contactId={contact?.id}
          companyId={company?.id}
          contactName={contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : company?.company_name}
        />
      </TabsContent>

      <TabsContent value="leads" className="mt-4">
        <LeadsTab scope={scope} />
      </TabsContent>

      <TabsContent value="lms" className="mt-4">
        <LMSLeadsTab scope={scope} contactEmail={contact?.email} />
      </TabsContent>

      <TabsContent value="files" className="mt-4">
        <FilesPanel scope={{ contactId: contact?.id, companyId: company?.id }} />
      </TabsContent>
    </Tabs>
  );
}
