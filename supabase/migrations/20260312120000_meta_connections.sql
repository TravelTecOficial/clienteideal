-- Tabela meta_connections: credenciais WhatsApp Business (Cloud API) por company_id
-- Usada pelo fluxo Embedded Signup. access_token armazena token criptografado (AES-256-GCM).

CREATE TABLE public.meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  clerk_user_id text NOT NULL,
  provider_type text NOT NULL DEFAULT 'whatsapp',
  external_account_id text,           -- WABA_ID
  external_phone_id text,              -- PHONE_ID
  display_phone_number text,
  access_token text NOT NULL,          -- criptografado (AES-256-GCM)
  status text DEFAULT 'active',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, provider_type)
);

ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ver meta_connections da empresa do seu profile; saas_admin vê todas
CREATE POLICY "Users can view meta_connections of their company"
  ON public.meta_connections
  FOR SELECT
  USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM public.profiles
      WHERE id = auth.jwt() ->> 'sub' AND company_id IS NOT NULL
    )
  );

CREATE INDEX idx_meta_connections_company_id
  ON public.meta_connections(company_id);

-- Service role (Edge Functions) bypassa RLS para INSERT/UPDATE
COMMENT ON TABLE public.meta_connections IS 'Conexões Meta (WhatsApp Cloud API) por empresa. Tokens criptografados em repouso.';
