# CRM MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server that exposes
this CRM (contacts, companies, leads, deals, pipelines, email templates, and
sequences) to MCP clients such as Claude Code.

It runs as a Supabase Edge Function at:

```
https://<project-ref>.supabase.co/functions/v1/mcp
```

Transport: **Streamable HTTP / JSON-RPC 2.0** (single `POST` endpoint).

## What Claude can do

| Tool | Purpose |
| --- | --- |
| `list_leads`, `get_lead`, `create_lead` | Read and create leads |
| `list_contacts`, `get_contact`, `create_contact`, `update_contact` | Manage contacts (customers) |
| `list_companies`, `get_company`, `create_company`, `update_company` | Manage companies |
| `list_deals`, `create_deal` | Manage deals |
| `list_pipelines`, `create_pipeline`, `create_pipeline_stage` | Create and inspect pipelines (stages can be seeded in one call) |
| `list_email_templates`, `create_email_template` | Write reusable email bodies (welcome, nurture, etc.) |
| `list_sequences`, `get_sequence`, `create_sequence` | Build multi-step email sequences |
| `enroll_contact_in_sequence`, `list_sequence_enrollments` | Schedule a sequence for a contact at a specific time |
| `schedule_welcome_email` | Write + schedule a one-off welcome email in a single call |

All queries are scoped to the authenticated user (`user_id`) — each caller only
sees and edits their own CRM data.

## Scheduling model

Emails are sent by the existing `process-sequences` cron/edge function. To
schedule an email you either:

1. Call `schedule_welcome_email` (convenience) — creates a one-step sequence
   and an enrollment with `next_email_at = send_at`, or
2. Call `create_sequence` with ordered steps, then
   `enroll_contact_in_sequence` with `next_email_at` set to when the first
   step should fire.

Merge tags available in subjects and bodies: `{{first_name}}`, `{{last_name}}`,
`{{email}}`, `{{company}}`.

## Connecting Claude Code

You need two things from your Supabase project:

- **Project URL** — `https://<project-ref>.supabase.co`
- **Anon key** — found in Supabase Dashboard → Project Settings → API
- **User access token (JWT)** — a logged-in user's `access_token` (e.g. from
  `supabase.auth.getSession()` in the web app, or from a dev login). The MCP
  server scopes data to whichever user that token belongs to.

Add an entry to your Claude Code MCP config (e.g. `~/.claude.json` under
`mcpServers`, or per-project `.mcp.json`):

```json
{
  "mcpServers": {
    "crm": {
      "type": "http",
      "url": "https://<project-ref>.supabase.co/functions/v1/mcp",
      "headers": {
        "apikey": "<SUPABASE_ANON_KEY>",
        "Authorization": "Bearer <SUPABASE_USER_JWT>"
      }
    }
  }
}
```

Or via the CLI:

```bash
claude mcp add --transport http crm \
  https://<project-ref>.supabase.co/functions/v1/mcp \
  --header "apikey: <SUPABASE_ANON_KEY>" \
  --header "Authorization: Bearer <SUPABASE_USER_JWT>"
```

After restarting Claude Code you can verify with `/mcp` — you should see the
`crm` server connected and its tools listed.

## Deploying

```bash
supabase functions deploy mcp
```

The function reads `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` from the edge function environment (already set by
Supabase by default).

## Smoke test

```bash
curl -sS -X POST \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_USER_JWT" \
  -H "Content-Type: application/json" \
  https://<project-ref>.supabase.co/functions/v1/mcp \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

You should get back a JSON-RPC response with a `tools` array.
