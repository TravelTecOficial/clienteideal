-- Adiciona descricao em prompt_templates (descritivo exibido ao usuário no dashboard).
ALTER TABLE public.prompt_templates
  ADD COLUMN IF NOT EXISTS descricao text;

COMMENT ON COLUMN public.prompt_templates.descricao IS 'Descritivo do template exibido ao usuário no dashboard.';
