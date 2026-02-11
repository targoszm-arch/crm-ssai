

# Fix: Emails Not Appearing Due to Missing user_id

## The Problem
The `sync-emails` edge function inserts emails into the database **without setting `user_id`**. Since the emails table has RLS policies that filter by `auth.uid() = user_id`, all 731 recently synced emails are invisible to you. Only 557 older emails (that had `user_id` set) are visible.

## The Fix

### 1. Fix the edge function (`supabase/functions/sync-emails/index.ts`)
- Read `user_id` from the email account record (line ~105 already fetches the full account)
- Add `user_id: account.user_id` to the email insert (around line 310)

### 2. Backfill existing NULL emails (one-time data fix)
- Update all 731 emails that have `user_id = NULL` and `account_id = '22104790-...'` to set the correct `user_id` from the account owner
- This will be done via a SQL migration that sets `emails.user_id = email_accounts.user_id` wherever it's NULL

## Changes

### File: `supabase/functions/sync-emails/index.ts`
- Add `user_id: account.user_id` to the insert object at line ~310 (one line addition)

### Database: Backfill migration
- SQL: `UPDATE emails SET user_id = ea.user_id FROM email_accounts ea WHERE emails.account_id = ea.id AND emails.user_id IS NULL`

## Result
- All 731 missing emails will immediately appear in your inbox
- All future syncs will correctly tag emails with your user ID
- No other changes needed

