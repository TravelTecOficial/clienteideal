-- Corrige admin_webhook_config: adiciona coluna webhook_chat e registro chat
-- Execute no SQL Editor do Supabase: https://supabase.com/dashboard/project/mrkvvgofjyvlutqpvedt/sql

ALTER TABLE public.admin_webhook_config
  DROP CONSTRAINT IF EXISTS admin_webhook_config_config_type_check;

ALTER TABLE public.admin_webhook_config
  ADD CONSTRAINT admin_webhook_config_config_type_check
  CHECK (config_type IN ('consorcio', 'produtos', 'chat'));

ALTER TABLE public.admin_webhook_config
  ADD COLUMN IF NOT EXISTS webhook_chat text;

INSERT INTO public.admin_webhook_config (config_type, webhook_chat)
VALUES ('chat', NULL)
ON CONFLICT (config_type) DO NOTHING;
