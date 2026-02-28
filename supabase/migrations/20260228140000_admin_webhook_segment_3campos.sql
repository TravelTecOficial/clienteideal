-- Remove Chat de Conhecimento como config separada.
-- Cada segmento (Consórcio, Produtos) passa a ter 3 webhooks: Produção, Teste, Enviar arquivos.

-- 1. Adicionar novas colunas
ALTER TABLE public.admin_webhook_config
  ADD COLUMN IF NOT EXISTS webhook_producao text,
  ADD COLUMN IF NOT EXISTS webhook_teste text;

-- 2. Migrar dados: webhook_testar_atendente -> webhook_teste
UPDATE public.admin_webhook_config
SET webhook_teste = COALESCE(webhook_teste, webhook_testar_atendente)
WHERE config_type IN ('consorcio', 'produtos');

-- 3. Remover coluna antiga
ALTER TABLE public.admin_webhook_config
  DROP COLUMN IF EXISTS webhook_testar_atendente;

-- 4. Remover config 'chat' e coluna webhook_chat
DELETE FROM public.admin_webhook_config WHERE config_type = 'chat';
ALTER TABLE public.admin_webhook_config DROP COLUMN IF EXISTS webhook_chat;

-- 5. Atualizar constraint: apenas consorcio e produtos
ALTER TABLE public.admin_webhook_config
  DROP CONSTRAINT IF EXISTS admin_webhook_config_config_type_check;

ALTER TABLE public.admin_webhook_config
  ADD CONSTRAINT admin_webhook_config_config_type_check
  CHECK (config_type IN ('consorcio', 'produtos'));

COMMENT ON COLUMN public.admin_webhook_config.webhook_producao IS 'Webhook N8N para produção (Evolution e Chat de Conhecimento)';
COMMENT ON COLUMN public.admin_webhook_config.webhook_teste IS 'Webhook N8N para testes (Chat de Conhecimento em modo teste)';
COMMENT ON COLUMN public.admin_webhook_config.webhook_enviar_arquivos IS 'Webhook N8N para enviar arquivos';
