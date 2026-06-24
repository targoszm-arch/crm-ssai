# Skill Studio AI CRM (Clari CRM)

A CRM platform for e-commerce businesses. Built with Vite + React + TypeScript +
shadcn/ui, backed by Supabase (Postgres, Auth, Edge Functions).

## Tech stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (database, auth, edge functions)

## Local development

Requires Node.js & npm.

```sh
# Install dependencies
npm install

# Start the dev server (http://localhost:8080)
npm run dev
```

## Environment variables

Create a `.env` file (or set these in your hosting provider) with:

```
VITE_SUPABASE_PROJECT_ID=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_GOOGLE_CLIENT_ID=...
```

These are public (anon) client keys and are safe to expose in the built frontend.

## Build

```sh
npm run build      # production build to dist/
npm run preview    # preview the production build locally
```

## Deployment (Vercel)

This project is configured for Vercel via `vercel.json` (Vite framework, SPA
rewrites for client-side routing).

- **CI/CD:** connect the GitHub repo to a Vercel project; pushes to `main` deploy
  automatically.
- **CLI:** `vercel` for a preview deploy, `vercel --prod` for production.

Set the `VITE_*` environment variables in the Vercel project settings (or rely on
the committed `.env`, since the keys are public).

### OAuth note

Google OAuth uses a fixed redirect URI. After deploying to a new domain, update
the redirect URI in `src/pages/OAuthCallback.tsx` and the `get-google-config`
edge function, and add the new `<domain>/oauth/callback` URL to the authorized
redirect URIs in Google Cloud Console.

## Backend (Supabase)

Edge functions and migrations live under `supabase/`. Deploy functions with the
Supabase CLI:

```sh
supabase functions deploy <function-name> --project-ref <project-ref>
```
