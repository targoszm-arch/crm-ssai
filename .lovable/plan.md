
# Plan: Fix View Button Functionality in Customers and Organisations Tabs

## Issues Identified

### Issue 1: CustomersTab "View" Button Doesn't Work
**Root Cause**: The View button in the Customers tab is missing its onClick handler entirely.

**Current Code (Line 428 in CustomersTab.tsx):**
```tsx
cell: () => <Button variant="ghost" size="sm">View</Button>,
```

This button renders but does nothing when clicked - there's no event handler attached.

### Issue 2: OrganisationsTab Drawer Shows Empty
**Root Cause**: The Organisations View button works correctly (it has a proper onClick handler), but the drawer may appear empty because:
1. Most organisations you're clicking have 0 contacts associated
2. The query for contacts by company ID is working correctly (verified via database query)

From database analysis:
- 1,596 total contacts exist
- 1,107 contacts have a company_id (about 69%)
- All company_ids in contacts match valid companies

Many organisations have 0 contacts - when you click View on these, the drawer correctly shows "No contacts yet" but this may appear as "empty".

---

## Solution

### 1. Add Contact Detail Modal and View Functionality to CustomersTab

Create a new ContactDetail component (similar to OrganisationDetail) and add proper state management and click handlers to the Customers tab.

### 2. Verify OrganisationDetail Is Working

The OrganisationDetail component appears correctly implemented. The issue may be user testing on organisations with 0 contacts.

---

## Technical Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/customers/ContactDetail.tsx` | Contact detail drawer/sheet component |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/customers/CustomersTab.tsx` | Add state for selected contact, add onClick handler to View button, add ContactDetail component |

---

## ContactDetail Component Structure

```typescript
interface ContactDetailProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDetail({ contact, open, onOpenChange }: ContactDetailProps) {
  // Show contact details in a Sheet/Drawer
  // Include: name, avatar, email, phone, title, company, social links
  // Include: notes, marketing status, seniority, etc.
}
```

---

## CustomersTab Changes

**Add state:**
```typescript
const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
const [detailOpen, setDetailOpen] = useState(false);
```

**Add handler:**
```typescript
const handleViewContact = (contact: Contact) => {
  setSelectedContact(contact);
  setDetailOpen(true);
};
```

**Fix View button (line 428):**
```typescript
cell: (contact: ContactWithCompany) => (
  <Button 
    variant="ghost" 
    size="sm" 
    onClick={() => handleViewContact(contact)}
  >
    <Eye className="h-4 w-4 mr-1" />
    View
  </Button>
),
```

**Add component at bottom of JSX:**
```tsx
<ContactDetail
  contact={selectedContact}
  open={detailOpen}
  onOpenChange={setDetailOpen}
/>
```

---

## ContactDetail Features

The contact detail drawer will display:

| Section | Fields |
|---------|--------|
| Header | Avatar, Full name, Job title, Company name |
| Contact Info | Email (clickable mailto:), Phone (clickable tel:), Location |
| Social Links | LinkedIn, Facebook, Instagram |
| Details | Marketing status, Seniority level, Function |
| AI Insights | Interest level, Buying signals, Pain points, LQS score |
| Notes | Personalisation notes, Next recommended action |

---

## Implementation Steps

1. **Create ContactDetail** - New component with Sheet/drawer showing contact information
2. **Update CustomersTab** - Add state, handler, and connect View button
3. **Add Eye icon import** - Ensure Eye icon is imported from lucide-react
4. **Test both tabs** - Verify View buttons work in both Organisations and Customers tabs

---

## Summary

| Tab | Issue | Fix |
|-----|-------|-----|
| Customers | View button has no onClick | Add handleViewContact handler and ContactDetail component |
| Organisations | Drawer appears empty | Works correctly - user was likely clicking orgs with 0 contacts |
