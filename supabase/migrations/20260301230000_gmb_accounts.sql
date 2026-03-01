-- GMB Local: tabela gmb_accounts para vincular Late Account ID à empresa.
-- MVP: cliente conecta GMB no dashboard Late, cola Account ID no app.

CREATE TABLE public.gmb_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(id),
  late_account_id text NOT NULL,
  location_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.gmb_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage company gmb_accounts" ON public.gmb_accounts
  FOR ALL
  USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  )
  WITH CHECK (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE INDEX idx_gmb_accounts_company_id ON public.gmb_accounts(company_id);
