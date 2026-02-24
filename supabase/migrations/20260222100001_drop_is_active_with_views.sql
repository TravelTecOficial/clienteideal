-- Remove is_active de prompt_template_stages.
-- As views view_stages_por_empresa, view_stage_por_empresa e view_atendimento_n8n
-- dependem de is_active. Recriamos usando enabled no lugar.

-- 1. Remove as views que dependem de is_active
DROP VIEW IF EXISTS public.view_atendimento_n8n CASCADE;
DROP VIEW IF EXISTS public.view_stages_por_empresa CASCADE;
DROP VIEW IF EXISTS public.view_stage_por_empresa CASCADE;

-- 2. Remove a coluna is_active
ALTER TABLE public.prompt_template_stages
  DROP COLUMN IF EXISTS is_active;

-- 3. Recria view_atendimento_n8n (não usa prompt_template_stages)
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

-- 4. Recria view_stages_por_empresa (usa enabled no lugar de pts.is_active)
--    prompt_templates não tem is_active; filtra apenas por pts.enabled
CREATE OR REPLACE VIEW public.view_stages_por_empresa AS
SELECT
  pa.company_id,
  lower(TRIM(BOTH FROM pts.stage_key)) AS stage_key,
  pts.ordem
FROM public.prompt_atendimento pa
JOIN public.prompt_templates pt ON pa.prompt_template_id = pt.id
JOIN public.prompt_template_stages pts ON pt.id = pts.template_id
WHERE pts.enabled = true
ORDER BY pts.ordem;

-- 5. Recria view_stage_por_empresa (usa enabled no lugar de pts.is_active)
CREATE OR REPLACE VIEW public.view_stage_por_empresa AS
SELECT
  pa.company_id,
  pts.template_id,
  lower(TRIM(BOTH FROM pts.stage_key)) AS nome_estagio,
  pts.ordem,
  pts.enabled as is_active
FROM public.prompt_template_stages pts
JOIN public.prompt_templates pt ON pts.template_id = pt.id
JOIN public.prompt_atendimento pa ON pa.prompt_template_id = pt.id
WHERE pts.enabled = true
ORDER BY pts.ordem;
