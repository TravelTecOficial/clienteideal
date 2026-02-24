-- Remove criatividade_temperatura e max_tokens de prompt_atendimento.
-- Esses valores passam a vir do template (prompt_templates) via prompt_template_id.
-- Se não houver template selecionado, consumidores devem usar defaults (5, 1024).
-- A view view_atendimento_n8n depende dessas colunas; recriamos a view para obter os valores do template.

DROP VIEW IF EXISTS public.view_atendimento_n8n;

ALTER TABLE public.prompt_atendimento
  DROP COLUMN IF EXISTS criatividade_temperatura,
  DROP COLUMN IF EXISTS max_tokens;

-- Recria a view para n8n: criatividade_temperatura e max_tokens vêm do template ou defaults.
CREATE OR REPLACE VIEW public.view_atendimento_n8n AS
SELECT
  pa.id,
  pa.created_at,
  pa.updated_at,
  pa.company_id,
  pa.nome_atendente,
  pa.principais_instrucoes,
  pa.papel,
  pa.tom_voz,
  pa.persona_id,
  pa.prompt_template_id,
  pa.fluxo_objetivo,
  pa.follow_up_active,
  pa.follow_up_tempo,
  pa.follow_up_tentativas,
  COALESCE(pt.criatividade_temperatura, 5)::integer AS criatividade_temperatura,
  COALESCE(pt.max_tokens, 1024)::integer AS max_tokens
FROM public.prompt_atendimento pa
LEFT JOIN public.prompt_templates pt ON pa.prompt_template_id = pt.id;
