-- Tabela wordpress_connections: URL e token do site WordPress por empresa.
-- Credenciais inseridas manualmente pelo usuário.

CREATE TABLE public.wordpress_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  site_url text NOT NULL,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.wordpress_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage wordpress_connections of their company"
  ON public.wordpress_connections
  FOR ALL
  USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  )
  WITH CHECK (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE INDEX idx_wordpress_connections_company_id
  ON public.wordpress_connections(company_id);

COMMENT ON TABLE public.wordpress_connections IS 'Conexões WordPress por empresa. URL e token inseridos pelo usuário.';
