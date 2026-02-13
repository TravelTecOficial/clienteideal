-- Reestruturação do Qualificador: qualificadores agrupam múltiplas perguntas com até 3 respostas cada

-- Tabela qualificadores (entidade agrupadora com nome)
CREATE TABLE IF NOT EXISTS public.qualificadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  company_id text NOT NULL,
  user_id text NOT NULL,
  nome text NOT NULL,
  ideal_customer_id uuid REFERENCES public.ideal_customers(id)
);

-- Tabela qualificacao_perguntas
CREATE TABLE IF NOT EXISTS public.qualificacao_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualificador_id uuid NOT NULL REFERENCES public.qualificadores(id) ON DELETE CASCADE,
  pergunta text NOT NULL,
  peso integer DEFAULT 1 CHECK (peso BETWEEN 1 AND 3),
  ordem integer NOT NULL DEFAULT 1
);

-- Tabela qualificacao_respostas (até 3 por pergunta: fria, morna, quente)
DO $$ BEGIN
  CREATE TYPE resposta_tipo AS ENUM ('fria', 'morna', 'quente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.qualificacao_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta_id uuid NOT NULL REFERENCES public.qualificacao_perguntas(id) ON DELETE CASCADE,
  resposta_texto text NOT NULL,
  tipo resposta_tipo NOT NULL,
  UNIQUE(pergunta_id, tipo)
);

-- Índices para consultas
CREATE INDEX IF NOT EXISTS idx_qualificadores_company ON public.qualificadores(company_id);
CREATE INDEX IF NOT EXISTS idx_qualificacao_perguntas_qualificador ON public.qualificacao_perguntas(qualificador_id);
CREATE INDEX IF NOT EXISTS idx_qualificacao_respostas_pergunta ON public.qualificacao_respostas(pergunta_id);

-- Migrar dados de qualificacoes (se existirem) - só se tabela qualificacoes existir
-- Cada qualificacao vira um qualificador com 1 pergunta e 3 respostas
DO $$
DECLARE
  r RECORD;
  qid uuid;
  pid uuid;
  tbl_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'qualificacoes') INTO tbl_exists;
  IF NOT tbl_exists THEN RETURN; END IF;

  FOR r IN SELECT * FROM public.qualificacoes
  LOOP
    INSERT INTO public.qualificadores (company_id, user_id, nome, ideal_customer_id)
    VALUES (r.company_id, r.user_id, COALESCE(r.pergunta, 'Qualificação migrada') || ' (legado)', r.ideal_customer_id)
    RETURNING id INTO qid;

    INSERT INTO public.qualificacao_perguntas (qualificador_id, pergunta, peso, ordem)
    VALUES (qid, r.pergunta, r.peso, 1)
    RETURNING id INTO pid;

    INSERT INTO public.qualificacao_respostas (pergunta_id, resposta_texto, tipo)
    VALUES
      (pid, r.resposta_fria, 'fria'::resposta_tipo),
      (pid, r.resposta_morna, 'morna'::resposta_tipo),
      (pid, r.resposta_quente, 'quente'::resposta_tipo);
  END LOOP;
END $$;

-- Dropar tabela antiga
DROP TABLE IF EXISTS public.qualificacoes;

-- RLS em qualificadores
ALTER TABLE public.qualificadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visualização por company_id" ON qualificadores;
CREATE POLICY "Visualização por company_id" ON qualificadores FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub')
    AND company_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Inserção por company_id" ON qualificadores;
CREATE POLICY "Inserção por company_id" ON qualificadores FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub')
    AND company_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Atualização por company_id" ON qualificadores;
CREATE POLICY "Atualização por company_id" ON qualificadores FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub')
    AND company_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Exclusão por company_id" ON qualificadores;
CREATE POLICY "Exclusão por company_id" ON qualificadores FOR DELETE USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub')
    AND company_id IS NOT NULL
  )
);

-- RLS em qualificacao_perguntas (via qualificador)
ALTER TABLE public.qualificacao_perguntas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visualização qualificacao_perguntas" ON qualificacao_perguntas;
CREATE POLICY "Visualização qualificacao_perguntas" ON qualificacao_perguntas FOR SELECT USING (
  qualificador_id IN (
    SELECT id FROM qualificadores
    WHERE company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub')
      AND company_id IS NOT NULL
    )
  )
);

DROP POLICY IF EXISTS "Inserção qualificacao_perguntas" ON qualificacao_perguntas;
CREATE POLICY "Inserção qualificacao_perguntas" ON qualificacao_perguntas FOR INSERT WITH CHECK (
  qualificador_id IN (
    SELECT id FROM qualificadores
    WHERE company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub')
      AND company_id IS NOT NULL
    )
  )
);

DROP POLICY IF EXISTS "Atualização qualificacao_perguntas" ON qualificacao_perguntas;
CREATE POLICY "Atualização qualificacao_perguntas" ON qualificacao_perguntas FOR UPDATE USING (
  qualificador_id IN (
    SELECT id FROM qualificadores
    WHERE company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub')
      AND company_id IS NOT NULL
    )
  )
);

DROP POLICY IF EXISTS "Exclusão qualificacao_perguntas" ON qualificacao_perguntas;
CREATE POLICY "Exclusão qualificacao_perguntas" ON qualificacao_perguntas FOR DELETE USING (
  qualificador_id IN (
    SELECT id FROM qualificadores
    WHERE company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub')
      AND company_id IS NOT NULL
    )
  )
);

-- RLS em qualificacao_respostas (via pergunta -> qualificador)
ALTER TABLE public.qualificacao_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visualização qualificacao_respostas" ON qualificacao_respostas;
CREATE POLICY "Visualização qualificacao_respostas" ON qualificacao_respostas FOR SELECT USING (
  pergunta_id IN (
    SELECT p.id FROM qualificacao_perguntas p
    JOIN qualificadores q ON q.id = p.qualificador_id
    WHERE q.company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub')
      AND company_id IS NOT NULL
    )
  )
);

DROP POLICY IF EXISTS "Inserção qualificacao_respostas" ON qualificacao_respostas;
CREATE POLICY "Inserção qualificacao_respostas" ON qualificacao_respostas FOR INSERT WITH CHECK (
  pergunta_id IN (
    SELECT p.id FROM qualificacao_perguntas p
    JOIN qualificadores q ON q.id = p.qualificador_id
    WHERE q.company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub')
      AND company_id IS NOT NULL
    )
  )
);

DROP POLICY IF EXISTS "Atualização qualificacao_respostas" ON qualificacao_respostas;
CREATE POLICY "Atualização qualificacao_respostas" ON qualificacao_respostas FOR UPDATE USING (
  pergunta_id IN (
    SELECT p.id FROM qualificacao_perguntas p
    JOIN qualificadores q ON q.id = p.qualificador_id
    WHERE q.company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub')
      AND company_id IS NOT NULL
    )
  )
);

DROP POLICY IF EXISTS "Exclusão qualificacao_respostas" ON qualificacao_respostas;
CREATE POLICY "Exclusão qualificacao_respostas" ON qualificacao_respostas FOR DELETE USING (
  pergunta_id IN (
    SELECT p.id FROM qualificacao_perguntas p
    JOIN qualificadores q ON q.id = p.qualificador_id
    WHERE q.company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub')
      AND company_id IS NOT NULL
    )
  )
);
