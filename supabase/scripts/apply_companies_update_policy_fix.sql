-- Execute no Supabase Dashboard > SQL Editor
-- Corrige: "grava mas não chega na tabela" - política RLS bloqueava o UPDATE

DROP POLICY IF EXISTS "Admins can update their company" ON companies;

CREATE POLICY "Admins can update their company" ON companies
  FOR UPDATE USING (
    public.is_saas_admin()
    OR id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );
