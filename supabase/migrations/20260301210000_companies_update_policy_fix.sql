-- Corrige política UPDATE de companies: permite saas_admin atualizar qualquer empresa
-- e usuários atualizarem a própria empresa (sem exigir role='admin').
-- Resolve: "grava mas não chega na tabela" quando usuário não é admin ou está em preview.

DROP POLICY IF EXISTS "Admins can update their company" ON companies;

CREATE POLICY "Admins can update their company" ON companies
  FOR UPDATE USING (
    public.is_saas_admin()
    OR id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );
