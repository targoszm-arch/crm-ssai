

# Push LMS Leads to Apollo API

## Overview
Create a scheduled edge function that syncs LMS leads from the `lms_leads` table to Apollo's People Match/Enrichment API, creating or updating contacts in Apollo. A tracking column will prevent re-processing already-synced leads.

## Steps

### 1. Add Apollo API Key Secret
Before building, you'll need to provide your Apollo API key. It will be stored securely as a Supabase Edge Function secret (`APOLLO_API_KEY`).

### 2. Database Migration -- Add Sync Tracking
Add columns to `lms_leads` to track Apollo sync status:
- `apollo_synced_at` (timestamptz, nullable) -- when last pushed to Apollo
- `apollo_contact_id` (text, nullable) -- Apollo's contact ID returned from the API

This avoids re-processing leads that have already been synced.

### 3. Create Edge Function: `sync-leads-apollo`
A new edge function at `supabase/functions/sync-leads-apollo/index.ts` that:

1. Uses the service role key to query all `lms_leads` where `apollo_synced_at IS NULL` (unsynced leads), limited to batches of 50
2. For each lead, calls Apollo's People Match API:
   ```
   POST https://api.apollo.io/api/v1/people/match
   Headers: x-api-key, Content-Type: application/json
   Body: { email, first_name, last_name, organization_name }
   ```
3. Parses the response and stores the returned `contact_id` from Apollo
4. Updates the `lms_leads` row with `apollo_synced_at = now()` and `apollo_contact_id`
5. Includes rate limiting (small delay between calls) to respect Apollo API limits
6. Returns a summary of synced/skipped/errored leads

The function will accept an optional `force` parameter to re-sync already-synced leads.

### 4. Register in `supabase/config.toml`
```toml
[functions.sync-leads-apollo]
verify_jwt = false
```

### 5. Set Up Cron Job
Create a `pg_cron` scheduled job that calls this function every hour (or configurable interval) using `pg_net`:
```sql
SELECT cron.schedule('sync-leads-apollo-hourly', '0 * * * *', ...);
```

### 6. Add Manual Trigger Button (Optional)
Add a "Sync to Apollo" button on the LMS Leads tab in the Customers page that calls the edge function on-demand.

## Technical Details

**Apollo API endpoint**: `POST https://api.apollo.io/api/v1/people/match`
- Sends: `email`, `first_name`, `last_name`, `organization_name` (derived from the lead's company association)
- Returns: enriched person data including Apollo `contact_id`, `linkedin_url`, `title`, `organization` details

**Data mapping from `lms_leads`**:
- `email` -> Apollo `email`
- `full_name` -> split into `first_name` / `last_name`
- Company name looked up from `companies` table via `company_id`

**Error handling**: Individual lead failures won't block the batch -- errors are logged and the lead remains unsynced for retry on the next run.

**New secret required**: `APOLLO_API_KEY`

