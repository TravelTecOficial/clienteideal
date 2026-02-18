-- Webhook global do Chat de Conhecimento (todas as empresas usam a mesma URL)
-- Adiciona config_type 'chat' e coluna webhook_chat para URL única

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
