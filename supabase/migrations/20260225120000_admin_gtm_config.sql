-- Configuração global do Google Tag Manager (head e body - uma única linha)
CREATE TABLE IF NOT EXISTS public.admin_gtm_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gtm_head text,
  gtm_body text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_gtm_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_gtm_config_service_role" ON public.admin_gtm_config;
CREATE POLICY "admin_gtm_config_service_role"
  ON public.admin_gtm_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Garantir uma única linha (singleton)
INSERT INTO public.admin_gtm_config (gtm_head, gtm_body)
SELECT NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.admin_gtm_config LIMIT 1);
