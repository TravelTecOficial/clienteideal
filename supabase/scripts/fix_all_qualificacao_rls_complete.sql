-- 1. Garantir coluna saas_admin em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saas_admin boolean NOT NULL DEFAULT false;

-- 2. Garantir função is_saas_admin()
CREATE OR REPLACE FUNCTION public.is_saas_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT saas_admin FROM profiles WHERE id = (auth.jwt() ->> 'sub')),
    false
  );
$$;

-- 3. Garantir coluna prompt_atendimento_id em qualificadores
ALTER TABLE public.qualificadores
  ADD COLUMN IF NOT EXISTS prompt_atendimento_id uuid REFERENCES public.prompt_atendimento(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_qualificadores_prompt_atendimento
  ON public.qualificadores(prompt_atendimento_id);

-- 4. QUALIFICADORES: SELECT + INSERT + UPDATE + DELETE
DROP POLICY IF EXISTS "Visualização por company_id" ON qualificadores;
CREATE POLICY "Visualização por company_id" ON qualificadores
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Inserção por company_id" ON qualificadores;
CREATE POLICY "Inserção por company_id" ON qualificadores
  FOR INSERT WITH CHECK (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Atualização por company_id" ON qualificadores;
CREATE POLICY "Atualização por company_id" ON qualificadores
  FOR UPDATE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Exclusão por company_id" ON qualificadores;
CREATE POLICY "Exclusão por company_id" ON qualificadores
  FOR DELETE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- 5. QUALIFICACAO_PERGUNTAS: SELECT + INSERT + UPDATE + DELETE
DROP POLICY IF EXISTS "Visualização qualificacao_perguntas" ON qualificacao_perguntas;
CREATE POLICY "Visualização qualificacao_perguntas" ON qualificacao_perguntas
  FOR SELECT USING (
    public.is_saas_admin()
    OR EXISTS (
      SELECT 1 FROM qualificadores q
      WHERE q.id = qualificacao_perguntas.qualificador_id
      AND q.company_id IN (
        SELECT company_id FROM profiles
        WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
      )
    )
  );

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

-- 6. QUALIFICACAO_RESPOSTAS: SELECT + INSERT + UPDATE + DELETE
DROP POLICY IF EXISTS "Visualização qualificacao_respostas" ON qualificacao_respostas;
CREATE POLICY "Visualização qualificacao_respostas" ON qualificacao_respostas
  FOR SELECT USING (
    public.is_saas_admin()
    OR EXISTS (
      SELECT 1 FROM qualificacao_perguntas qp
      JOIN qualificadores q ON q.id = qp.qualificador_id
      WHERE qp.id = qualificacao_respostas.pergunta_id
      AND q.company_id IN (
        SELECT company_id FROM profiles
        WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
      )
    )
  );

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

-- 7. VERIFICAÇÃO
SELECT
  schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('qualificadores', 'qualificacao_perguntas', 'qualificacao_respostas')
ORDER BY tablename, cmd;
