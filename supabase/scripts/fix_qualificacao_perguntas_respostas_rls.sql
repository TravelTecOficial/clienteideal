-- Execute no Supabase Dashboard > SQL Editor (projeto mrkvvgofjyvlutqpvedt)
-- Corrige RLS de qualificadores, qualificacao_perguntas e qualificacao_respostas: INSERT
-- não tinha is_saas_admin(). Erro: "new row violates row-level security policy for table qualificacao_perguntas".

-- QUALIFICADORES (INSERT também precisa de is_saas_admin para preview)
DROP POLICY IF EXISTS "Inserção por company_id" ON qualificadores;
CREATE POLICY "Inserção por company_id" ON qualificadores
  FOR INSERT WITH CHECK (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- QUALIFICACAO_PERGUNTAS
DROP POLICY IF EXISTS "Inserção qualificacao_perguntas" ON qualificacao_perguntas;
CREATE POLICY "Inserção qualificacao_perguntas" ON qualificacao_perguntas
  FOR INSERT WITH CHECK (
    public.is_saas_admin()
    OR qualificador_id IN (
      SELECT id FROM qualificadores
      WHERE company_id IN (
        SELECT company_id FROM profiles
        WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
      )
    )
  );

DROP POLICY IF EXISTS "Atualização qualificacao_perguntas" ON qualificacao_perguntas;
CREATE POLICY "Atualização qualificacao_perguntas" ON qualificacao_perguntas
  FOR UPDATE USING (
    public.is_saas_admin()
    OR qualificador_id IN (
      SELECT id FROM qualificadores
      WHERE company_id IN (
        SELECT company_id FROM profiles
        WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
      )
    )
  );

DROP POLICY IF EXISTS "Exclusão qualificacao_perguntas" ON qualificacao_perguntas;
CREATE POLICY "Exclusão qualificacao_perguntas" ON qualificacao_perguntas
  FOR DELETE USING (
    public.is_saas_admin()
    OR qualificador_id IN (
      SELECT id FROM qualificadores
      WHERE company_id IN (
        SELECT company_id FROM profiles
        WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
      )
    )
  );

-- QUALIFICACAO_RESPOSTAS
DROP POLICY IF EXISTS "Inserção qualificacao_respostas" ON qualificacao_respostas;
CREATE POLICY "Inserção qualificacao_respostas" ON qualificacao_respostas
  FOR INSERT WITH CHECK (
    public.is_saas_admin()
    OR pergunta_id IN (
      SELECT p.id FROM qualificacao_perguntas p
      JOIN qualificadores q ON q.id = p.qualificador_id
      WHERE q.company_id IN (
        SELECT company_id FROM profiles
        WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
      )
    )
  );

DROP POLICY IF EXISTS "Atualização qualificacao_respostas" ON qualificacao_respostas;
CREATE POLICY "Atualização qualificacao_respostas" ON qualificacao_respostas
  FOR UPDATE USING (
    public.is_saas_admin()
    OR pergunta_id IN (
      SELECT p.id FROM qualificacao_perguntas p
      JOIN qualificadores q ON q.id = p.qualificador_id
      WHERE q.company_id IN (
        SELECT company_id FROM profiles
        WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
      )
    )
  );

DROP POLICY IF EXISTS "Exclusão qualificacao_respostas" ON qualificacao_respostas;
CREATE POLICY "Exclusão qualificacao_respostas" ON qualificacao_respostas
  FOR DELETE USING (
    public.is_saas_admin()
    OR pergunta_id IN (
      SELECT p.id FROM qualificacao_perguntas p
      JOIN qualificadores q ON q.id = p.qualificador_id
      WHERE q.company_id IN (
        SELECT company_id FROM profiles
        WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
      )
    )
  );
