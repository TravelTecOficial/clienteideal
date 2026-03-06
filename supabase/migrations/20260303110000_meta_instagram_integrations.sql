-- Integração Meta/Instagram por empresa.
-- Armazena token de acesso criptografado (server-side) para chamadas Graph API.

CREATE TABLE public.meta_instagram_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  facebook_user_id text,
  facebook_user_name text,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  -- access_token_encrypted armazena token de acesso da Meta cifrado (AES-GCM) no formato iv:ciphertext (base64url).
  access_token_encrypted text NOT NULL,
  token_expires_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.meta_instagram_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage company meta_instagram_integrations"
  ON public.meta_instagram_integrations
  FOR ALL
  USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id
      FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  )
  WITH CHECK (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id
      FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE INDEX idx_meta_instagram_integrations_company_id
  ON public.meta_instagram_integrations(company_id);
