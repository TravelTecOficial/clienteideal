-- Tabela config_qualificacao: perguntas dinâmicas para o SDR (número variável)
CREATE TABLE IF NOT EXISTS public.config_qualificacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  company_id text NOT NULL REFERENCES public.companies(id),
  pergunta_texto text NOT NULL,
  peso integer NOT NULL DEFAULT 1 CHECK (peso BETWEEN 1 AND 3),
  criterio_frio text,
  criterio_morno text,
  criterio_quente text,
  ordem integer NOT NULL DEFAULT 1
);

-- Tabela leads_sessao: controle de estado da qualificação por lead (remote_jid)
CREATE TABLE IF NOT EXISTS public.leads_sessao (
  remote_jid text PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id),
  current_step integer NOT NULL DEFAULT 0,
  score_total integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluido')),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_config_qualificacao_company_ordem ON public.config_qualificacao(company_id, ordem);
CREATE INDEX IF NOT EXISTS idx_leads_sessao_company ON public.leads_sessao(company_id);

-- RLS config_qualificacao
ALTER TABLE public.config_qualificacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_qualificacao_select_company" ON public.config_qualificacao;
CREATE POLICY "config_qualificacao_select_company" ON public.config_qualificacao FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "config_qualificacao_insert_company" ON public.config_qualificacao;
CREATE POLICY "config_qualificacao_insert_company" ON public.config_qualificacao FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "config_qualificacao_update_company" ON public.config_qualificacao;
CREATE POLICY "config_qualificacao_update_company" ON public.config_qualificacao FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "config_qualificacao_delete_company" ON public.config_qualificacao;
CREATE POLICY "config_qualificacao_delete_company" ON public.config_qualificacao FOR DELETE USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
  )
);

-- RLS leads_sessao
ALTER TABLE public.leads_sessao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_sessao_select_company" ON public.leads_sessao;
CREATE POLICY "leads_sessao_select_company" ON public.leads_sessao FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "leads_sessao_insert_company" ON public.leads_sessao;
CREATE POLICY "leads_sessao_insert_company" ON public.leads_sessao FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "leads_sessao_update_company" ON public.leads_sessao;
CREATE POLICY "leads_sessao_update_company" ON public.leads_sessao FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
  )
);
