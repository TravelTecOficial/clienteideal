-- Configuração global da Evolution API (URL e API Key - uma única linha)
CREATE TABLE IF NOT EXISTS public.admin_evolution_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evolution_api_url text,
  evolution_api_key text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_evolution_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_evolution_config_service_role" ON public.admin_evolution_config;
CREATE POLICY "admin_evolution_config_service_role"
  ON public.admin_evolution_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Garantir uma única linha (singleton)
INSERT INTO public.admin_evolution_config (evolution_api_url, evolution_api_key)
SELECT NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.admin_evolution_config LIMIT 1);
