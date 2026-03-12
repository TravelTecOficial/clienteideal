-- Tabela google_connections: credenciais OAuth Google (GA4, Ads, My Business) por company_id
-- access_token e refresh_token criptografados (AES-256-GCM). refresh_token para renovação automática.
-- Idempotente: IF NOT EXISTS para tabela e índice; DROP IF EXISTS para policy.

CREATE TABLE IF NOT EXISTS public.google_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text DEFAULT 'active',
  connected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view google_connections of their company" ON public.google_connections;
CREATE POLICY "Users can view google_connections of their company"
  ON public.google_connections
  FOR SELECT
  USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM public.profiles
      WHERE id = auth.jwt() ->> 'sub' AND company_id IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_google_connections_company_id
  ON public.google_connections(company_id);

COMMENT ON TABLE public.google_connections IS 'Conexões Google (GA4, Ads, My Business) por empresa. Tokens criptografados em repouso.';
