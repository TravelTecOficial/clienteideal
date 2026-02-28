-- Execute no Supabase Dashboard > SQL Editor do projeto DEV (mrkvvgofjyvlutqpvedt)
-- Corrige RLS em Admin preview:
-- 1) INSERT/UPDATE/DELETE com is_saas_admin()
-- 2) Remove policy legada ALL que bloqueia por company_id
-- 3) SELECT com is_saas_admin()

DROP POLICY IF EXISTS "Empresas veem apenas seus prompts" ON prompt_atendimento;

DROP POLICY IF EXISTS "Users can view their company prompt_atendimento" ON prompt_atendimento;
CREATE POLICY "Users can view their company prompt_atendimento" ON prompt_atendimento
  FOR SELECT
  USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

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
