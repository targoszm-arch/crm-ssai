
# Add Settings Page with Webhook Configuration

## What This Does
Creates a new Settings page accessible from the sidebar, displaying your webhook details so you can easily copy and share them with external apps to send leads into your CRM.

## What You'll See

The Settings page will include an **Integrations / Webhook** section showing:
- The webhook endpoint URL (with a copy button)
- Required headers (x-api-key)
- Accepted fields (email, name, role, company_size, etc.)
- A ready-to-use example JSON payload (with copy button)
- A note that `crm_user_id` is auto-populated from the logged-in user's ID

## Technical Details

### New File: `src/pages/Settings.tsx`
- Settings page with a card-based layout
- **Webhook Configuration** card displaying:
  - Endpoint URL: `https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/lms-webhook`
  - Method: POST
  - Auth header: `x-api-key`
  - Copy-to-clipboard buttons for URL and sample payload
  - The logged-in user's `crm_user_id` fetched from `useAuth()` and pre-filled in the example
- Uses existing UI components: `Card`, `Button`, `SectionHeader`, `Badge`

### Modified File: `src/App.tsx`
- Add `/settings` route pointing to the new Settings page, wrapped in `AuthGuard` and `AppShell` (same pattern as all other routes)

### No Other Changes Needed
- The sidebar already links to `/settings` -- it will just start working once the route exists
