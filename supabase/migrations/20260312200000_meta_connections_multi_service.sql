-- Suporte a múltiplos serviços Meta (Instagram, Facebook, Meta Ads) em meta_connections.
-- Tokens Meta expiram em ~60 dias; WhatsApp pode manter NULL.

ALTER TABLE public.meta_connections
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

COMMENT ON COLUMN public.meta_connections.token_expires_at IS
  'Data de expiração do access_token. NULL para WhatsApp (tokens de longa duração).';
