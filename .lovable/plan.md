
# Plan: Fix Google OAuth Redirect URI Mismatch

## Problem

The `redirect_uri_mismatch` error occurs because:
1. The app builds the redirect URI dynamically: `${window.location.origin}/calendar`
2. This creates different URLs depending on which environment you're in (preview vs production)
3. Google requires **exact** matching of registered redirect URIs

## Solution

Create a centralized OAuth flow that:
1. Uses a **single, fixed redirect URI** that works everywhere
2. Fetches the **Google Client ID from Supabase secrets** via an edge function (solving the .env deletion issue)

## Architecture

```text
User clicks "Connect"
        |
        v
Edge Function: get-google-config
  - Returns Client ID from secrets
  - Returns the fixed redirect URI
        |
        v
Frontend redirects to Google OAuth
  - Uses fixed redirect URI: https://crm-ssai.lovable.app/oauth/callback
        |
        v
Google redirects back to /oauth/callback
        |
        v
Frontend calls google-auth-callback edge function
        |
        v
Redirect to original page (/calendar or /inbox)
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/get-google-config/index.ts` | Returns Google Client ID from secrets |
| `src/pages/OAuthCallback.tsx` | Handles OAuth callback for all Google integrations |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/calendar/ConnectCalendar.tsx` | Fetch Client ID from edge function, use fixed redirect |
| `src/components/inbox/ConnectGmail.tsx` | Fetch Client ID from edge function, use fixed redirect |
| `src/App.tsx` | Add `/oauth/callback` route |
| `supabase/config.toml` | Register new edge function |

---

## Implementation Details

### 1. New Edge Function: get-google-config

Returns the Google Client ID and fixed redirect URI from Supabase secrets:

```typescript
// Returns:
{
  clientId: "your-client-id.apps.googleusercontent.com",
  redirectUri: "https://crm-ssai.lovable.app/oauth/callback"
}
```

### 2. OAuth Callback Page

A new page at `/oauth/callback` that:
- Reads the `code` and `state` from URL parameters
- The `state` parameter contains the original page (e.g., "calendar" or "inbox")
- Calls the `google-auth-callback` edge function
- Redirects back to the original page

### 3. Updated Connect Components

Both `ConnectCalendar.tsx` and `ConnectGmail.tsx` will:
- Fetch the Google Client ID from the edge function (instead of .env)
- Use the fixed redirect URI
- Pass a `state` parameter indicating where to return after OAuth

### 4. Google Cloud Console Setup

You need to register this **exact** redirect URI in Google Cloud Console:

```
https://crm-ssai.lovable.app/oauth/callback
```

---

## Summary of Changes

| Component | Change |
|-----------|--------|
| New Edge Function | `get-google-config` - serves Client ID from secrets |
| New Page | `/oauth/callback` - centralized OAuth callback handler |
| ConnectCalendar | Fetch config from edge function, use fixed redirect |
| ConnectGmail | Fetch config from edge function, use fixed redirect |
| supabase/config.toml | Register new edge function |

---

## Google Cloud Console Action Required

After implementation, add this exact redirect URI to your Google Cloud Console OAuth credentials:

```
https://crm-ssai.lovable.app/oauth/callback
```

This single URI will handle both Gmail and Calendar OAuth flows.
