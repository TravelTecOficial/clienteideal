-- Adiciona vínculo opcional ao Template Master no prompt de atendimento.
-- Quando definido, o sistema pode usar as regras/ferramentas do template no estágio de atendimento.

ALTER TABLE public.prompt_atendimento
  ADD COLUMN IF NOT EXISTS prompt_template_id uuid REFERENCES public.prompt_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.prompt_atendimento.prompt_template_id IS 'Template Master selecionado (admin). Opcional.';
