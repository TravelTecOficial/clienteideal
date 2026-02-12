-- Qualificacoes: usar subquery em profiles para company_id (compatível com Clerk)
-- As políticas atuais usam auth.jwt() ->> 'company_id' que pode não estar no JWT.

DROP POLICY IF EXISTS "Visualização por company_id" ON qualificacoes;
CREATE POLICY "Visualização por company_id" ON qualificacoes FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub')
    AND company_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Inserção por company_id" ON qualificacoes;
CREATE POLICY "Inserção por company_id" ON qualificacoes FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub')
    AND company_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Atualização por company_id" ON qualificacoes;
CREATE POLICY "Atualização por company_id" ON qualificacoes FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub')
    AND company_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Exclusão por company_id" ON qualificacoes;
CREATE POLICY "Exclusão por company_id" ON qualificacoes FOR DELETE USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub')
    AND company_id IS NOT NULL
  )
);
