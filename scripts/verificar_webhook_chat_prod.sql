-- =============================================================================
-- Verificação e correção do webhook do Chat de Conhecimento em PROD
-- Execute no SQL Editor do Supabase: https://supabase.com/dashboard/project/SEU_PROJECT_REF/sql
-- =============================================================================

-- 1. Verificar se a tabela e coluna existem
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'admin_webhook_config'
ORDER BY ordinal_position;

-- 2. Verificar o registro chat e o valor de webhook_chat
SELECT config_type, webhook_chat, updated_at
FROM public.admin_webhook_config
WHERE config_type = 'chat';

-- 3. Se o registro não existir ou webhook_chat estiver NULL, execute o bloco abaixo:
-- (Descomente e ajuste a URL conforme necessário)

/*
-- Garantir que o schema permite config_type 'chat'
ALTER TABLE public.admin_webhook_config
  DROP CONSTRAINT IF EXISTS admin_webhook_config_config_type_check;

ALTER TABLE public.admin_webhook_config
  ADD CONSTRAINT admin_webhook_config_config_type_check
  CHECK (config_type IN ('consorcio', 'produtos', 'chat'));

-- Garantir que a coluna webhook_chat existe
ALTER TABLE public.admin_webhook_config
  ADD COLUMN IF NOT EXISTS webhook_chat text;

-- Inserir ou atualizar o registro chat (substitua a URL pela sua)
INSERT INTO public.admin_webhook_config (config_type, webhook_chat, updated_at)
VALUES ('chat', 'https://SEU-N8N.com/webhook/SUA-URL', now())
ON CONFLICT (config_type) DO UPDATE SET
  webhook_chat = EXCLUDED.webhook_chat,
  updated_at = EXCLUDED.updated_at;
*/
