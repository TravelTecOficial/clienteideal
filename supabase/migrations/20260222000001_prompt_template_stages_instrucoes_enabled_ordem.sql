-- Adiciona instrucoes, enabled e ordem em prompt_template_stages.
ALTER TABLE public.prompt_template_stages
  ADD COLUMN IF NOT EXISTS instrucoes text,
  ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0;

COMMENT ON COLUMN public.prompt_template_stages.instrucoes IS 'Instruções específicas do estágio (textarea).';
COMMENT ON COLUMN public.prompt_template_stages.enabled IS 'Se true, o estágio participa do template. Switch para habilitar/desabilitar.';
COMMENT ON COLUMN public.prompt_template_stages.ordem IS 'Ordem do estágio no template (numérico).';
