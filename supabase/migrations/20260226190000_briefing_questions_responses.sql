-- Questionário de Briefing Estratégico (5 pilares)
-- Perguntas globais gerenciadas pelo admin; respostas por empresa.

-- ENUMs
CREATE TYPE briefing_category AS ENUM (
  'dna_empresa',
  'produto_oferta',
  'publico_persona',
  'mercado_concorrencia',
  'objetivos_metas'
);

CREATE TYPE briefing_input_type AS ENUM (
  'texto_curto',
  'texto_longo',
  'selecao',
  'numerico'
);

-- Tabela de perguntas (global, admin gerencia)
CREATE TABLE public.briefing_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  category briefing_category NOT NULL,
  question_text text NOT NULL,
  help_text text,
  input_type briefing_input_type NOT NULL DEFAULT 'texto_curto',
  slug text NOT NULL UNIQUE,
  is_atrito boolean NOT NULL DEFAULT false,
  options jsonb,
  ordem integer NOT NULL DEFAULT 1
);

COMMENT ON TABLE public.briefing_questions IS 'Perguntas do Questionário de Briefing Estratégico. Admin gerencia; empresas respondem no Chat de Briefing.';
COMMENT ON COLUMN public.briefing_questions.slug IS 'ID de referência para mapeamento (ex: oferta_ticket_medio). snake_case.';
COMMENT ON COLUMN public.briefing_questions.is_atrito IS 'Pergunta de Atrito: peso maior na vetorização para IA identificar fraquezas/forças.';
COMMENT ON COLUMN public.briefing_questions.options IS 'Opções para input_type=selecao. Array JSON de strings.';

CREATE INDEX idx_briefing_questions_category ON public.briefing_questions(category);
CREATE INDEX idx_briefing_questions_slug ON public.briefing_questions(slug);

-- Tabela de respostas (por empresa)
CREATE TABLE public.company_briefing_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.briefing_questions(id) ON DELETE CASCADE,
  response_value text,
  UNIQUE(company_id, question_id)
);

COMMENT ON TABLE public.company_briefing_responses IS 'Respostas das empresas ao Questionário de Briefing. Uma resposta por pergunta por empresa.';

CREATE INDEX idx_company_briefing_responses_company ON public.company_briefing_responses(company_id);
CREATE INDEX idx_company_briefing_responses_question ON public.company_briefing_responses(question_id);

-- RLS
ALTER TABLE public.briefing_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_briefing_responses ENABLE ROW LEVEL SECURITY;

-- briefing_questions: SELECT para authenticated (Chat de Briefing e Admin leem); escrita via service_role (Edge Function)
CREATE POLICY "Authenticated users can view briefing_questions"
  ON public.briefing_questions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "briefing_questions_service_role"
  ON public.briefing_questions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- company_briefing_responses: usuários da empresa podem ver/inserir/atualizar suas respostas (Clerk: auth.jwt() ->> 'sub')
CREATE POLICY "Users can view own company briefing responses"
  ON public.company_briefing_responses
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can insert own company briefing responses"
  ON public.company_briefing_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can update own company briefing responses"
  ON public.company_briefing_responses
  FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- Seed: perguntas de exemplo por categoria
INSERT INTO public.briefing_questions (category, question_text, help_text, input_type, slug, is_atrito, ordem) VALUES
  ('dna_empresa', 'Qual a história da sua empresa?', 'Conte como tudo começou e o que motivou a criação do negócio.', 'texto_longo', 'dna_historia', false, 1),
  ('dna_empresa', 'Qual o principal diferencial (USP) da sua empresa?', 'O que torna sua empresa única no mercado?', 'texto_curto', 'dna_usp', true, 2),
  ('produto_oferta', 'Qual o ticket médio do seu produto/serviço?', 'Isso ajuda a IA a entender o esforço de venda necessário.', 'numerico', 'oferta_ticket_medio', true, 1),
  ('produto_oferta', 'Quais dores principais seu produto resolve?', 'Liste as principais dores ou problemas que sua solução aborda.', 'texto_longo', 'oferta_dores', false, 2),
  ('publico_persona', 'Descreva o perfil demográfico do seu cliente ideal.', 'Idade, localização, renda, profissão, etc.', 'texto_longo', 'persona_demografia', false, 1),
  ('publico_persona', 'Como é a jornada de compra do seu cliente?', 'Da descoberta até a decisão de compra.', 'texto_longo', 'persona_jornada', false, 2),
  ('mercado_concorrencia', 'Quem são seus principais concorrentes?', 'Liste os principais players do mercado.', 'texto_curto', 'mercado_concorrentes', false, 1),
  ('mercado_concorrencia', 'Quais tendências do mercado impactam seu negócio?', 'Tendências positivas ou negativas que você observa.', 'texto_longo', 'mercado_tendencias', false, 2),
  ('objetivos_metas', 'Quais são seus principais KPIs de negócio?', 'Métricas que você acompanha (vendas, conversão, etc.).', 'texto_curto', 'objetivos_kpis', false, 1),
  ('objetivos_metas', 'Qual o orçamento mensal para marketing/vendas?', 'Valor aproximado em reais para investimento em aquisição.', 'numerico', 'objetivos_orcamento', true, 2);
