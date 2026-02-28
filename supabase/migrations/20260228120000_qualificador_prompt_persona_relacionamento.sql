-- Alteração de relacionamento: Qualificador -> Prompt (em vez de Persona)
-- Persona passa a ter prompt_atendimento_id; Qualificador passa a ter prompt_atendimento_id

-- 1. ideal_customers: adicionar prompt_atendimento_id
ALTER TABLE public.ideal_customers
  ADD COLUMN IF NOT EXISTS prompt_atendimento_id uuid REFERENCES public.prompt_atendimento(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.ideal_customers.prompt_atendimento_id IS 'Prompt de atendimento associado a este persona. Seleção feita no formulário do Persona.';

-- Backfill: para cada prompt_atendimento com persona_id, atualizar ideal_customers
UPDATE public.ideal_customers ic
SET prompt_atendimento_id = pa.id
FROM public.prompt_atendimento pa
WHERE pa.persona_id = ic.id
  AND pa.company_id = ic.company_id
  AND ic.prompt_atendimento_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ideal_customers_prompt_atendimento
  ON public.ideal_customers(prompt_atendimento_id);

-- 2. qualificadores: adicionar prompt_atendimento_id
ALTER TABLE public.qualificadores
  ADD COLUMN IF NOT EXISTS prompt_atendimento_id uuid REFERENCES public.prompt_atendimento(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.qualificadores.prompt_atendimento_id IS 'Prompt de atendimento ao qual este qualificador está vinculado.';

-- Backfill: para qualificadores com ideal_customer_id, localizar prompt_atendimento correspondente
UPDATE public.qualificadores q
SET prompt_atendimento_id = pa.id
FROM public.prompt_atendimento pa
WHERE pa.persona_id = q.ideal_customer_id
  AND pa.company_id = q.company_id
  AND q.prompt_atendimento_id IS NULL
  AND q.ideal_customer_id IS NOT NULL;

-- Remover coluna ideal_customer_id
ALTER TABLE public.qualificadores
  DROP COLUMN IF EXISTS ideal_customer_id;

CREATE INDEX IF NOT EXISTS idx_qualificadores_prompt_atendimento
  ON public.qualificadores(prompt_atendimento_id);

-- 3. Recriar view v_qualificacao_sdr com prompt_atendimento_id e persona_id (para filtro n8n)
DROP VIEW IF EXISTS public.v_qualificacao_sdr;
CREATE VIEW public.v_qualificacao_sdr AS
SELECT
  q.company_id,
  q.id AS qualificador_id,
  q.prompt_atendimento_id,
  pa.persona_id,
  qp.id AS pergunta_id,
  qp.pergunta AS pergunta_texto,
  COALESCE(qp.peso, 1) AS peso,
  qp.ordem,
  STRING_AGG(CASE WHEN qr.tipo = 'fria' THEN qr.resposta_texto END, ' | ' ORDER BY qr.resposta_texto) AS criterio_frio,
  STRING_AGG(CASE WHEN qr.tipo = 'morna' THEN qr.resposta_texto END, ' | ' ORDER BY qr.resposta_texto) AS criterio_morno,
  STRING_AGG(CASE WHEN qr.tipo = 'quente' THEN qr.resposta_texto END, ' | ' ORDER BY qr.resposta_texto) AS criterio_quente,
  q.pontuacao_maxima,
  q.limite_frio_max,
  q.limite_morno_max
FROM public.qualificadores q
JOIN public.qualificacao_perguntas qp ON qp.qualificador_id = q.id
LEFT JOIN public.qualificacao_respostas qr ON qr.pergunta_id = qp.id
LEFT JOIN public.prompt_atendimento pa ON pa.id = q.prompt_atendimento_id
GROUP BY q.id, q.company_id, q.prompt_atendimento_id, pa.persona_id, q.pontuacao_maxima, q.limite_frio_max, q.limite_morno_max,
  qp.id, qp.pergunta, qp.peso, qp.ordem;

COMMENT ON VIEW public.v_qualificacao_sdr IS 'Qualificadores com perguntas/respostas. Inclui prompt_atendimento_id e persona_id para filtro por persona no n8n.';
