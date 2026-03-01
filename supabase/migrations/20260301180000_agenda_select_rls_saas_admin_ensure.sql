-- Garante que a política SELECT da agenda inclui is_saas_admin().
-- Necessário porque 20260226200000 pode ter sido marcada como applied sem execução real.

DROP POLICY IF EXISTS "Users can view company agenda" ON agenda;
CREATE POLICY "Users can view company agenda" ON agenda
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );
