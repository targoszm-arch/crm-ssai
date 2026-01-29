

# Plan: Create Relationship Between Organisations & Customers

## The Issue

Your CSV file only contained **company/organisation data** (names, domains, connection strength, etc.) - not individual contact/customer data. That's why:

- **Organisations tab**: Shows 2,038 companies (correctly imported)
- **Customers tab**: Shows 0 contacts (expected - no contact data in CSV)

The `contacts` table needs individual people (first name, last name, email, phone) to be populated separately.

---

## What We'll Fix

### 1. Create Proper Database Relationship
Add a foreign key constraint linking contacts to companies:

```sql
ALTER TABLE contacts 
ADD CONSTRAINT fk_contacts_company 
FOREIGN KEY (company_id) REFERENCES companies(id) 
ON DELETE SET NULL;
```

### 2. Add Sample Contacts for Testing
Insert sample contacts linked to your imported companies so you can see the relationship working:

| First Name | Last Name | Email | Company |
|------------|-----------|-------|---------|
| John | Smith | john@heygen.com | HeyGen |
| Sarah | Connor | sarah@gamma.app | Gamma |
| Mike | Johnson | mike@revolut.com | Revolut |
| Emma | Williams | emma@shopify.com | Shopify |
| David | Brown | david@vercel.com | Vercel |

### 3. Enhance Organisation Detail View
When clicking an organisation, show:
- Company details
- List of linked contacts/customers
- Ability to add new contacts to that organisation

### 4. Add Contact Creation with Company Selection
Update the "Add New" button functionality:
- Form to add new contact
- Dropdown to select which company they belong to
- Pre-populate company when adding from organisation detail

---

## UI Improvements

### Organisation Row Actions
Add a "View Contacts" action on each organisation row to see linked customers.

### Customer Row Enhancement
Show the linked company name prominently (already partially implemented).

### Add Contact Modal
Create a form with:
- First Name, Last Name, Email, Phone
- Company dropdown (searchable)
- Title, Work Location, Notes

---

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `src/components/customers/AddContactModal.tsx` | Modal form to add new contacts |
| `src/components/customers/OrganisationDetail.tsx` | Detail view showing linked contacts |
| `src/components/customers/OrganisationsTab.tsx` | Add row actions and detail view |
| `src/components/customers/CustomersTab.tsx` | Enhance company display |
| `src/hooks/useContacts.ts` | Add mutation for creating contacts |

---

## Implementation Steps

1. **Database**: Add foreign key constraint between contacts and companies
2. **Sample Data**: Insert sample contacts linked to existing companies
3. **Add Contact Modal**: Create form with company selection
4. **Organisation Detail**: Show linked contacts when clicking an organisation
5. **Connect "Add New" Button**: Wire up to contact creation modal

---

## Summary

The contacts table is empty because your CSV only had company data. We'll:
1. Create proper database relationships
2. Add sample data so you can see it working
3. Build the UI to add and view contacts linked to organisations

