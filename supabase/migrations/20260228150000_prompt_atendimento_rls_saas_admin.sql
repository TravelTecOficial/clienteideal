-- Corrige RLS de prompt_atendimento: INSERT/UPDATE/DELETE não tinham is_saas_admin().
-- A migration saas_admin_preview_rls alterou apenas SELECT. Ao fazer preview de outra empresa,
-- o admin usa company_id da empresa em preview, que não está no profile do admin → RLS bloqueava.

DROP POLICY IF EXISTS "Users can insert company prompt_atendimento" ON prompt_atendimento;
CREATE POLICY "Users can insert company prompt_atendimento" ON prompt_atendimento
  FOR INSERT
  WITH CHECK (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can update company prompt_atendimento" ON prompt_atendimento;
CREATE POLICY "Users can update company prompt_atendimento" ON prompt_atendimento
  FOR UPDATE
  USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can delete company prompt_atendimento" ON prompt_atendimento;
CREATE POLICY "Users can delete company prompt_atendimento" ON prompt_atendimento
  FOR DELETE
  USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );
