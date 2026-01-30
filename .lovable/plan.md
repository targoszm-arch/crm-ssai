
# Fix: Campaign Stats, View Details, and Contact Association Display

## Issues Found

### Issue 1: Campaign Stats Show 0
The Meet Alfred API is returning campaign data, but:
- Campaign names show as "Campaign {id}" instead of actual names
- Stats like `total_leads` and `sent_count` are 0 because the API returns these fields with different names

**Root Cause:** The edge function extracts `campaign.name` but the API returns it in a different field. The API likely returns:
- `sequence_name` or `title` instead of `name`
- `leads_count` or `total` instead of `total_leads`

### Issue 2: View Details Not Working
The "View Details" dropdown menu item in `Campaigns.tsx` has no click handler - it's a placeholder.

### Issue 3: Contact Display in LinkedIn Messages
The contact linking is actually **working correctly** in the database:
- `linkedin_connections` has `contact_id` properly set
- Messages are linked to connections via `connection_id`
- The join path exists: `linkedin_messages` -> `linkedin_connections` -> `contacts`

However, the UI components don't fully utilize this data:
- `LinkedInMessageList.tsx` falls back to `sender_linkedin_id` instead of showing `sender_name`
- The contact badge only shows if `message.connection?.contacts` exists (via foreign key join)

---

## Solution

### 1. Fix Campaign Data Extraction

Update the edge function to try multiple field names from the Meet Alfred API:

```typescript
// In meetalfred-sync/index.ts - campaigns sync
const campaignName = 
  campaign.name || 
  campaign.sequence_name || 
  campaign.title || 
  `Campaign ${campaign.id}`;

const totalLeads = 
  campaign.total_leads || 
  campaign.leads_count || 
  campaign.total || 
  campaign.count || 
  0;

const status = 
  campaign.status || 
  (campaign.is_active ? "active" : "draft") ||
  "active";
```

Also add logging to capture the raw campaign response structure for debugging.

### 2. Implement Campaign Detail View

Create a campaign detail modal/sheet that shows:
- Campaign name and status
- Sequence type and steps
- Lead list associated with the campaign
- Activity timeline from the campaign

Add click handler to "View Details":
```typescript
<DropdownMenuItem onClick={() => openCampaignDetail(campaign)}>
  View Details
</DropdownMenuItem>
```

Create `CampaignDetailModal.tsx` component.

### 3. Fix Contact Display in Message List

Update `LinkedInMessageList.tsx` to show sender name from message directly:

```typescript
// Show sender_name first, then connection name, then fallback
const senderName = message.sender_name || message.connection?.name || message.sender_linkedin_id;
```

Update `useLinkedInMessages.ts` to include the `sender_name` field in the select and interface.

---

## Detailed Changes

### File 1: `supabase/functions/meetalfred-sync/index.ts`

**Changes:**
- Add full raw response logging for campaigns
- Try multiple field names for campaign name, leads count, status
- Log individual campaign data extraction for debugging

```typescript
// Campaigns sync section
console.log("=== CAMPAIGNS API RAW RESPONSE ===");
console.log(JSON.stringify(campaignsData, null, 2));

for (const campaign of campaignsArray) {
  console.log(`Processing campaign ${campaign.id}:`, JSON.stringify(campaign, null, 2));
  
  const campaignName = 
    campaign.name || 
    campaign.sequence_name || 
    campaign.title || 
    campaign.campaign_name ||
    `Campaign ${campaign.id}`;
    
  const totalLeads = 
    campaign.total_leads || 
    campaign.leads_count || 
    campaign.people_count ||
    campaign.contacts_count ||
    0;
    
  const sequenceType = 
    campaign.sequence_type || 
    campaign.type || 
    campaign.campaign_type ||
    null;
}
```

### File 2: `src/pages/Campaigns.tsx`

**Changes:**
- Add state for selected campaign
- Create campaign detail dialog/sheet
- Add click handler to View Details menu item
- Add View Leads functionality to navigate to Customers filtered by campaign

```typescript
const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

// In dropdown menu
<DropdownMenuItem onClick={() => setSelectedCampaign(campaign)}>
  View Details
</DropdownMenuItem>
<DropdownMenuItem onClick={() => navigate(`/customers?campaign=${campaign.name}`)}>
  View Leads
</DropdownMenuItem>

// Add CampaignDetailSheet component
<Sheet open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
  ...
</Sheet>
```

### File 3: `src/components/inbox/LinkedInMessageList.tsx`

**Changes:**
- Use `sender_name` from message as primary display name
- Add campaign badge showing which campaign the message came from
- Show company name if available

```typescript
// Line 71 - change from:
{message.connection?.name || message.sender_linkedin_id}

// To:
{message.sender_name || message.connection?.name || message.sender_linkedin_id}

// Add campaign badge
{message.campaign_name && (
  <Badge variant="outline" className="text-xs">
    {message.campaign_name}
  </Badge>
)}
```

### File 4: `src/hooks/useLinkedInMessages.ts`

**Changes:**
- Ensure `sender_name`, `campaign_name`, `company_name` are included in select
- Update interface if needed

```typescript
export interface LinkedInMessage {
  // ... existing fields
  sender_name: string | null;
  campaign_name: string | null;
  company_name: string | null;
}
```

### File 5: New Component `src/components/campaigns/CampaignDetailSheet.tsx`

Create a sheet/dialog component that displays:
- Campaign name, status badge, type
- Sequence type and configuration
- Stats (leads, sent count, open rate)
- Lead list from the campaign (query leads table filtered by source)
- Recent activities related to the campaign

---

## Database: Add unique constraint for leads table

The edge function logs show: `"Lead upsert: there is no unique or exclusion constraint matching the ON CONFLICT specification"`

Need to add a unique constraint on the `leads` table:

```sql
-- Add unique constraint on email (if not null)
ALTER TABLE leads ADD CONSTRAINT leads_email_unique UNIQUE (email);
```

This will allow the upsert to work correctly for leads with emails.

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/meetalfred-sync/index.ts` | Add campaign field name fallbacks, full logging |
| `src/pages/Campaigns.tsx` | Add campaign detail sheet, fix dropdown handlers |
| `src/components/campaigns/CampaignDetailSheet.tsx` | New component for campaign details |
| `src/components/inbox/LinkedInMessageList.tsx` | Use sender_name, show campaign badge |
| `src/hooks/useLinkedInMessages.ts` | Ensure all fields in interface |
| Database migration | Add unique constraint on leads.email |

---

## Expected Outcome

After these fixes:
1. Campaign names will display correctly from Meet Alfred
2. Campaign stats (leads, sent) will show actual values if available from API
3. "View Details" opens a sheet with full campaign information
4. "View Leads" navigates to Customers filtered by campaign
5. LinkedIn message list shows sender names correctly
6. Campaign badges show in message list
7. Lead syncing won't fail due to missing unique constraint
