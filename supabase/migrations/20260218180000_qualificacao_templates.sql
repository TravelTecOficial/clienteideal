-- Modelos de qualificação globais (admin). Usuários copiam para qualificadores da sua empresa.
CREATE TABLE public.qualificacao_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  nome text NOT NULL,
  segment_type text NOT NULL DEFAULT 'geral' CHECK (segment_type IN ('geral', 'produtos', 'consorcio', 'seguros'))
);

COMMENT ON TABLE public.qualificacao_templates IS 'Modelos de qualificação criados pelo admin. Licenças copiam para qualificadores.';

CREATE TABLE public.qualificacao_template_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.qualificacao_templates(id) ON DELETE CASCADE,
  pergunta text NOT NULL,
  peso integer DEFAULT 1 CHECK (peso BETWEEN 1 AND 3),
  ordem integer NOT NULL DEFAULT 1
);

CREATE TABLE public.qualificacao_template_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta_id uuid NOT NULL REFERENCES public.qualificacao_template_perguntas(id) ON DELETE CASCADE,
  resposta_texto text NOT NULL,
  tipo resposta_tipo NOT NULL,
  pontuacao integer NOT NULL,
  UNIQUE(pergunta_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_qualificacao_templates_segment ON public.qualificacao_templates(segment_type);
CREATE INDEX IF NOT EXISTS idx_qualificacao_template_perguntas_template ON public.qualificacao_template_perguntas(template_id);
CREATE INDEX IF NOT EXISTS idx_qualificacao_template_respostas_pergunta ON public.qualificacao_template_respostas(pergunta_id);

ALTER TABLE public.qualificacao_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualificacao_template_perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualificacao_template_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view qualificacao_templates" ON public.qualificacao_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view qualificacao_template_perguntas" ON public.qualificacao_template_perguntas
  FOR SELECT TO authenticated USING (
    template_id IN (SELECT id FROM public.qualificacao_templates)
  );

CREATE POLICY "Authenticated users can view qualificacao_template_respostas" ON public.qualificacao_template_respostas
  FOR SELECT TO authenticated USING (
    pergunta_id IN (
      SELECT id FROM public.qualificacao_template_perguntas
      WHERE template_id IN (SELECT id FROM public.qualificacao_templates)
    )
  );
