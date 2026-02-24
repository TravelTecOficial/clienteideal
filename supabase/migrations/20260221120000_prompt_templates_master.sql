-- Templates Master: modelos de prompt por estágio do fluxo (admin).
-- Cada template tem estágios: inicial, atendimento, qualificacao, agendamento, grupo, pagamento, encerramento.

CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  nome text NOT NULL
);

COMMENT ON TABLE public.prompt_templates IS 'Templates Master de prompts por estágio. Admin cria e gerencia.';

CREATE TABLE IF NOT EXISTS public.prompt_template_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  template_id uuid NOT NULL REFERENCES public.prompt_templates(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  rules_do jsonb NOT NULL DEFAULT '[]',
  rules_dont jsonb NOT NULL DEFAULT '[]',
  tools jsonb NOT NULL DEFAULT '[]',
  UNIQUE(template_id, stage_key)
);

COMMENT ON TABLE public.prompt_template_stages IS 'Configuração de cada estágio do template: rules_do, rules_dont e tools (JSON).';
COMMENT ON COLUMN public.prompt_template_stages.rules_do IS 'Array de strings: o que fazer.';
COMMENT ON COLUMN public.prompt_template_stages.rules_dont IS 'Array de strings: o que não fazer.';
COMMENT ON COLUMN public.prompt_template_stages.tools IS 'Array de { name, description, parameters: string[] }.';

CREATE INDEX IF NOT EXISTS idx_prompt_template_stages_template ON public.prompt_template_stages(template_id);

ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_template_stages ENABLE ROW LEVEL SECURITY;

-- RLS: usuários autenticados podem ler/escrever (página protegida por isSaasAdmin na UI).
-- Para produção, considerar policy que valide auth.jwt() ->> 'role' = 'admin'.
DROP POLICY IF EXISTS "Authenticated users can manage prompt_templates" ON public.prompt_templates;
CREATE POLICY "Authenticated users can manage prompt_templates" ON public.prompt_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage prompt_template_stages" ON public.prompt_template_stages;
CREATE POLICY "Authenticated users can manage prompt_template_stages" ON public.prompt_template_stages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger updated_at (função set_updated_at já existe)
DROP TRIGGER IF EXISTS prompt_templates_updated_at ON public.prompt_templates;
CREATE TRIGGER prompt_templates_updated_at
  BEFORE UPDATE ON public.prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS prompt_template_stages_updated_at ON public.prompt_template_stages;
CREATE TRIGGER prompt_template_stages_updated_at
  BEFORE UPDATE ON public.prompt_template_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
