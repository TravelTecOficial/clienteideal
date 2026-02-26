-- v1.0.4: Permitir múltiplos prompts de atendimento por empresa, cada um associado a um persona.
-- view_atendimento_n8n passa a retornar N linhas por empresa. Consumidores (n8n/Evolution) devem
-- filtrar por (company_id, persona_id) quando o lead tiver persona; usar persona_id IS NULL como fallback.

-- 1. Remove views que dependem de prompt_atendimento
DROP VIEW IF EXISTS public.view_atendimento_n8n CASCADE;
DROP VIEW IF EXISTS public.view_stages_por_empresa CASCADE;
DROP VIEW IF EXISTS public.view_stage_por_empresa CASCADE;

-- 2. Remove constraint UNIQUE(company_id)
ALTER TABLE public.prompt_atendimento
  DROP CONSTRAINT IF EXISTS prompt_atendimento_company_id_key;

-- 3. Adiciona coluna name para identificar cada prompt na lista
ALTER TABLE public.prompt_atendimento
  ADD COLUMN IF NOT EXISTS name text;

COMMENT ON COLUMN public.prompt_atendimento.name IS 'Nome opcional para identificar o prompt na lista.';

-- 4. Índices únicos parciais: 1 prompt "sem persona" por empresa; 1 prompt por (company_id, persona_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_atendimento_company_default
  ON public.prompt_atendimento (company_id)
  WHERE persona_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_atendimento_company_persona
  ON public.prompt_atendimento (company_id, persona_id)
  WHERE persona_id IS NOT NULL;

-- 5. Recria view_atendimento_n8n (retorna múltiplos registros por empresa)
CREATE OR REPLACE VIEW public.view_atendimento_n8n AS
SELECT
  pa.id,
  pa.created_at,
  pa.updated_at,
  pa.company_id,
  pa.name,
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

COMMENT ON VIEW public.view_atendimento_n8n IS 'Retorna N prompts por empresa. Filtrar por company_id e persona_id. Usar persona_id IS NULL como fallback.';

-- 6. Recria view_stages_por_empresa (agora retorna stages de todos os prompts; n8n filtra por persona)
CREATE OR REPLACE VIEW public.view_stages_por_empresa AS
SELECT
  pa.company_id,
  pa.persona_id,
  lower(TRIM(BOTH FROM pts.stage_key)) AS stage_key,
  pts.ordem
FROM public.prompt_atendimento pa
JOIN public.prompt_templates pt ON pa.prompt_template_id = pt.id
JOIN public.prompt_template_stages pts ON pt.id = pts.template_id
WHERE pts.enabled = true
ORDER BY pa.company_id, pa.persona_id NULLS FIRST, pts.ordem;

-- 7. Recria view_stage_por_empresa (inclui persona_id para filtro)
CREATE OR REPLACE VIEW public.view_stage_por_empresa AS
SELECT
  pa.company_id,
  pa.persona_id,
  pts.template_id,
  lower(TRIM(BOTH FROM pts.stage_key)) AS nome_estagio,
  pts.ordem,
  pts.enabled AS is_active
FROM public.prompt_template_stages pts
JOIN public.prompt_templates pt ON pts.template_id = pt.id
JOIN public.prompt_atendimento pa ON pa.prompt_template_id = pt.id
WHERE pts.enabled = true
ORDER BY pa.company_id, pa.persona_id NULLS FIRST, pts.ordem;
