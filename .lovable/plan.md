
# Plan: Import Companies & Build Customers/Organisations Views

## Overview
Transform the Customers page into a full-featured CRM view with data from your CSV file (2,049 companies), implementing:
- Import all companies from CSV to Supabase
- Add new columns to match CSV data
- Create filtering and sorting capabilities
- Build separate tabbed views for Customers (contacts) and Organisations (companies)

---

## What We'll Build

### 1. Database Schema Updates
Add new columns to the `companies` table to store CSV data:
- `linkedin_url` - LinkedIn profile URL
- `description` - Company description
- `country` - Primary location country  
- `foundation_date` - When company was founded
- `twitter_followers` - Twitter follower count
- `domains` - Company domain(s)
- `categories` - Company categories
- `connection_strength` - Relationship strength (Very weak, Weak, Good, Very strong)
- `last_interaction` - Last interaction timestamp
- `estimated_arr` - Estimated Annual Recurring Revenue
- `funding_raised` - Total funding raised
- `employee_range` - Employee count range

### 2. Data Import
Import all ~2,049 companies from your CSV file into the `companies` table via SQL insert statements.

### 3. Updated Customers Page with Tabs
Create a tabbed interface with two views:

**Customers Tab (Contacts)**
- Display individual contacts from the `contacts` table
- Show columns: Name, Email, Phone, Company, Title, Last Contacted, Work Location

**Organisations Tab (Companies)**
- Display companies from the `companies` table
- Show columns: Company Name, Domain, Country, Connection Strength, Last Interaction, Employee Range, Estimated ARR

### 4. Filtering System
Add filter dropdowns for:
- **Organisations**: Connection Strength, Country, Employee Range
- **Customers**: Company, Work Location

### 5. Sorting Capabilities
Enable column header click-to-sort with:
- Ascending/descending toggle
- Sort indicators on columns
- Sortable columns: Name, Last Interaction, Connection Strength, Created Date

---

## Technical Details

### Files to Create
| File | Purpose |
|------|---------|
| `src/components/customers/CustomersTab.tsx` | Contacts list with filters |
| `src/components/customers/OrganisationsTab.tsx` | Companies list with filters |
| `src/components/customers/DataFilters.tsx` | Reusable filter component |
| `src/hooks/useCompanies.ts` | Supabase hook for companies data |
| `src/hooks/useContacts.ts` | Supabase hook for contacts data |

### Files to Modify
| File | Changes |
|------|---------|
| `src/pages/Customers.tsx` | Add tabbed interface with Customers/Organisations views |
| `src/components/ui/data-table.tsx` | Add sortable column headers |

### Database Migration
```sql
-- Add new columns to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS foundation_date DATE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS twitter_followers INTEGER;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS domains TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS categories TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS connection_strength TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_interaction TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS estimated_arr NUMERIC;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS funding_raised NUMERIC;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS employee_range TEXT;
```

### CSV Data Mapping
| CSV Column | Database Column |
|------------|-----------------|
| Record ID | id |
| Record | company_name |
| LinkedIn | linkedin_url |
| Description | description |
| Primary location > Country | country |
| Foundation date | foundation_date |
| Twitter follower count | twitter_followers |
| Domains | domains |
| Categories | categories |
| Connection strength | connection_strength |
| Last interaction > When | last_interaction |
| Estimated ARR | estimated_arr |
| Funding raised | funding_raised |
| Employee range | employee_range |

---

## UI Preview

```text
+------------------------------------------------------------------+
|  Customers                                                        |
|  Manage and view all your customers and organisations             |
+------------------------------------------------------------------+
|  [Customers]  [Organisations]                    [+ Add New]     |
+------------------------------------------------------------------+
|  Filters: [Connection Strength v] [Country v] [Employee Range v] |
|  Search: [________________________]                               |
+------------------------------------------------------------------+
|  Company Name    | Domain      | Country | Strength | Last Int.  |
|------------------|-------------|---------|----------|------------|
|  HeyGen          | heygen.com  |    -    | V.Strong | Jan 5 2026 |
|  PropGen         | propgen.ie  |    -    | V.Strong | Jul 11 2025|
|  Gamma           | gamma.app   |    -    | V.Strong | Jan 22 2026|
|  Vuse            | vuse.com    |    -    | Good     | Jan 7 2026 |
+------------------------------------------------------------------+
```

---

## Implementation Steps

1. **Database**: Run migration to add new columns to companies table
2. **Data Import**: Insert all 2,049 companies from CSV into database
3. **Hooks**: Create React Query hooks for fetching companies and contacts
4. **Components**: Build filter and tab components  
5. **Page**: Update Customers page with tabbed interface
6. **Table**: Enhance DataTable with sorting capability
