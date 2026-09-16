-- Server-side store for OAuth refresh tokens.
--
-- Revolut's consent lapses periodically, so re-authorising is a recurring
-- chore, not a one-off. Keeping the refresh token in an Edge Function secret
-- forced a trip to the Supabase dashboard every time. Here the function can
-- write it itself, so re-auth is: paste the code into the app, click, done.
--
-- RLS is enabled with NO policies on purpose. That denies every authenticated
-- and anonymous request outright — the table is reachable only by the service
-- role, i.e. only from inside an edge function. The browser can neither read
-- nor write it, which is the same protection a secret had.

CREATE TABLE IF NOT EXISTS public.finance_oauth_tokens (
  provider      TEXT PRIMARY KEY,
  refresh_token TEXT NOT NULL,
  obtained_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.finance_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Belt and braces: RLS already blocks these roles, but an accidental future
-- GRANT shouldn't quietly expose the column.
REVOKE ALL ON public.finance_oauth_tokens FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_finance_oauth_tokens_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS finance_oauth_tokens_updated_at ON public.finance_oauth_tokens;
CREATE TRIGGER finance_oauth_tokens_updated_at
  BEFORE UPDATE ON public.finance_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_finance_oauth_tokens_updated_at();
