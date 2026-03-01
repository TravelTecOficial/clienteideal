-- Permite que admins do SaaS (profiles.saas_admin = true) insiram, atualizem e excluam
-- agendamentos ao visualizar empresas em modo preview.
-- Alinha agenda às demais tabelas que já têm is_saas_admin() em SELECT.

DROP POLICY IF EXISTS "Users can insert company agenda" ON agenda;
CREATE POLICY "Users can insert company agenda" ON agenda
  FOR INSERT WITH CHECK (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can update company agenda" ON agenda;
CREATE POLICY "Users can update company agenda" ON agenda
  FOR UPDATE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can delete company agenda" ON agenda;
CREATE POLICY "Users can delete company agenda" ON agenda
  FOR DELETE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );
