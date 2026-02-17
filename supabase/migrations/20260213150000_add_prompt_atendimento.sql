-- Tabela de configuração do Prompt de Atendimento (IA)
-- Uma configuração por empresa (company_id)

CREATE TABLE public.prompt_atendimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome_atendente text,
  principais_instrucoes text,
  papel text,
  tom_voz text,
  persona_id uuid REFERENCES public.ideal_customers(id) ON DELETE SET NULL,
  criatividade_temperatura integer DEFAULT 5 CHECK (criatividade_temperatura >= 1 AND criatividade_temperatura <= 10),
  max_tokens integer DEFAULT 1024 CHECK (max_tokens > 0),
  UNIQUE(company_id)
);

-- RLS
ALTER TABLE public.prompt_atendimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company prompt_atendimento" ON prompt_atendimento
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can insert company prompt_atendimento" ON prompt_atendimento
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can update company prompt_atendimento" ON prompt_atendimento
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can delete company prompt_atendimento" ON prompt_atendimento
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prompt_atendimento_updated_at
  BEFORE UPDATE ON public.prompt_atendimento
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
