-- The Inbox re-ran a full Gmail sync on every single mount because nothing recorded
-- when the last one happened. With this, the client can ask "is a sync actually due?"
-- and the function can pull only what arrived since, instead of re-walking 30 days.
alter table public.email_accounts
  add column if not exists last_sync_at timestamptz;
