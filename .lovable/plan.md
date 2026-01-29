
# Plan: Fix "Link to Contact" Empty Dropdown

## Problem Analysis

The "Link to contact" dropdown shows empty because:

1. **RLS policies require authentication** - The security fix we applied earlier restricts the `contacts` table to authenticated users only
2. **No authentication in the app** - The application has no login/signup functionality
3. **Anonymous requests fail** - The Supabase client uses the anonymous key, which the RLS policies now reject

## Solution Options

I'll present two options and let you choose:

---

### Option A: Revert to Public Access (Quick Fix)

Undo the RLS policy change for the `contacts` table so data is accessible without login.

| Pros | Cons |
|------|------|
| Fast, 1 migration | Security vulnerability returns |
| No code changes | Not recommended for production |

---

### Option B: Add User Authentication (Recommended)

Implement a proper authentication system with login/signup pages.

| Pros | Cons |
|------|------|
| Secure by design | More work (3-4 files) |
| Follows best practices | Users need to log in |
| Enables per-user data later | - |

---

## Recommended: Option B - Add Authentication

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/Auth.tsx` | Login and signup page with email/password |
| `src/hooks/useAuth.ts` | Authentication state management hook |
| `src/components/auth/AuthGuard.tsx` | Wrapper to protect routes requiring login |

### Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add auth route, wrap protected routes with AuthGuard |

---

## Implementation Details

### 1. Authentication Page (`src/pages/Auth.tsx`)

A simple login/signup form with:
- Email and password fields
- Toggle between login and signup modes
- Error handling and loading states
- Redirect to dashboard on success

### 2. Auth Hook (`src/hooks/useAuth.ts`)

```text
- Track current user session
- Listen for auth state changes
- Provide signIn, signUp, signOut functions
- Auto-refresh on page load
```

### 3. Auth Guard Component

- Checks if user is authenticated
- Shows loading state while checking
- Redirects to /auth if not logged in
- Renders children if authenticated

### 4. App.tsx Updates

- Add `/auth` route for login page
- Wrap existing routes with AuthGuard
- Auth callback route remains public

---

## After Implementation

Once logged in, the Supabase client will automatically include the user's JWT token in requests, allowing the RLS policies to pass and showing contacts in the dropdown.

---

## Technical Notes

- Uses Supabase's built-in `auth.signInWithPassword()` and `auth.signUp()`
- Session is persisted in localStorage automatically
- Token refresh is handled by the Supabase client

---

## Summary

The dropdown is empty because there's no logged-in user, and the new security policies require authentication. We need to add a login system so users can authenticate before accessing CRM data.
