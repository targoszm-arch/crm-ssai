-- Fix security definer view by recreating as security invoker
DROP VIEW IF EXISTS public.email_accounts_safe;

CREATE VIEW public.email_accounts_safe
WITH (security_invoker = true)
AS SELECT
  id,
  user_id,
  provider,
  email_address,
  expires_at,
  created_at,
  updated_at
FROM public.email_accounts;