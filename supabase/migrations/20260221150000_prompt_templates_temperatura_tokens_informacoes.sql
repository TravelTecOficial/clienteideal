-- Adiciona criatividade_temperatura, max_tokens e informacoes_uso em prompt_templates.
-- Esses valores passam a ser definidos no admin; o dashboard usa os do template selecionado.

ALTER TABLE public.prompt_templates
  ADD COLUMN IF NOT EXISTS criatividade_temperatura integer DEFAULT 5 CHECK (criatividade_temperatura >= 1 AND criatividade_temperatura <= 10),
  ADD COLUMN IF NOT EXISTS max_tokens integer DEFAULT 1024 CHECK (max_tokens > 0),
  ADD COLUMN IF NOT EXISTS informacoes_uso text;

COMMENT ON COLUMN public.prompt_templates.criatividade_temperatura IS 'Temperatura da IA (1-10). Definido no admin.';
COMMENT ON COLUMN public.prompt_templates.max_tokens IS 'Máximo de tokens na resposta. Definido no admin.';
COMMENT ON COLUMN public.prompt_templates.informacoes_uso IS 'Informações e instruções de uso do template (texto livre).';
