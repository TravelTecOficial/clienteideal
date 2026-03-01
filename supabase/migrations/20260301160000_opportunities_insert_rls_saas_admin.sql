-- Permite que admins do SaaS (saas_admin) insiram oportunidades em modo preview.
-- A política SELECT e UPDATE já têm is_saas_admin() (via 20260226200000 e 20260301120000).
-- Faltava apenas INSERT e DELETE.

DROP POLICY IF EXISTS "Users can insert company opportunities" ON opportunities;
CREATE POLICY "Users can insert company opportunities" ON opportunities
  FOR INSERT WITH CHECK (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can delete company opportunities" ON opportunities;
CREATE POLICY "Users can delete company opportunities" ON opportunities
  FOR DELETE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );
