-- Corrige admin_webhook_config: adiciona colunas webhook_producao e webhook_teste
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor) ou via: npx supabase db push

-- 1. Adicionar colunas se não existirem
ALTER TABLE public.admin_webhook_config
  ADD COLUMN IF NOT EXISTS webhook_producao text,
  ADD COLUMN IF NOT EXISTS webhook_teste text;

-- 2. Migrar dados antigos (se webhook_testar_atendente existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_webhook_config'
    AND column_name = 'webhook_testar_atendente'
  ) THEN
    UPDATE public.admin_webhook_config
    SET webhook_teste = COALESCE(webhook_teste, webhook_testar_atendente)
    WHERE config_type IN ('consorcio', 'produtos');
    ALTER TABLE public.admin_webhook_config DROP COLUMN IF EXISTS webhook_testar_atendente;
  END IF;
END $$;

-- 3. Remover config 'chat' se existir
DELETE FROM public.admin_webhook_config WHERE config_type = 'chat';

-- 4. Atualizar constraint
ALTER TABLE public.admin_webhook_config
  DROP CONSTRAINT IF EXISTS admin_webhook_config_config_type_check;

ALTER TABLE public.admin_webhook_config
  ADD CONSTRAINT admin_webhook_config_config_type_check
  CHECK (config_type IN ('consorcio', 'produtos'));

-- 5. Garantir registros consorcio e produtos
INSERT INTO public.admin_webhook_config (config_type, webhook_producao, webhook_teste, webhook_enviar_arquivos)
VALUES 
  ('consorcio', NULL, NULL, NULL),
  ('produtos', NULL, NULL, NULL)
ON CONFLICT (config_type) DO NOTHING;
