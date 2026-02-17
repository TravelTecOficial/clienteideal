-- Tabela para armazenar webhooks por tipo de configuração (admin)
CREATE TABLE IF NOT EXISTS public.admin_webhook_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type text NOT NULL CHECK (config_type IN ('consorcio', 'produtos')),
  webhook_testar_atendente text,
  webhook_enviar_arquivos text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(config_type)
);

-- RLS: acesso via Edge Functions com service role (admin config e upload kb)
ALTER TABLE public.admin_webhook_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_webhook_config_service_role"
  ON public.admin_webhook_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Inserir registros padrão para consorcio e produtos
INSERT INTO public.admin_webhook_config (config_type, webhook_testar_atendente, webhook_enviar_arquivos)
VALUES 
  ('consorcio', NULL, NULL),
  ('produtos', NULL, NULL)
ON CONFLICT (config_type) DO NOTHING;
