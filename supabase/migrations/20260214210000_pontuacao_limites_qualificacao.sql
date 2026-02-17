-- Adiciona pontuação em qualificacao_respostas e limites dinâmicos em qualificadores
-- Pontuação = peso × valor_tipo (fria=1, morna=5, quente=10)
-- Limites = 1/3 e 2/3 da pontuação máxima possível

-- 1. qualificacao_respostas: coluna pontuacao
ALTER TABLE public.qualificacao_respostas
ADD COLUMN IF NOT EXISTS pontuacao integer;

-- Backfill: calcular pontuacao para registros existentes
UPDATE public.qualificacao_respostas qr
SET pontuacao = (
  COALESCE(qp.peso, 1) * CASE qr.tipo::text
    WHEN 'fria' THEN 1
    WHEN 'morna' THEN 5
    WHEN 'quente' THEN 10
    ELSE 5
  END
)
FROM public.qualificacao_perguntas qp
WHERE qr.pergunta_id = qp.id
  AND qr.pontuacao IS NULL;

-- Tornar NOT NULL após backfill
ALTER TABLE public.qualificacao_respostas
ALTER COLUMN pontuacao SET NOT NULL;

-- 2. qualificadores: colunas de limites
ALTER TABLE public.qualificadores
ADD COLUMN IF NOT EXISTS pontuacao_maxima integer,
ADD COLUMN IF NOT EXISTS limite_frio_max integer,
ADD COLUMN IF NOT EXISTS limite_morno_max integer;

-- Backfill: calcular limites para qualificadores existentes
WITH somas AS (
  SELECT
    qp.qualificador_id,
    SUM(COALESCE(qp.peso, 1) * 10) AS max_total
  FROM public.qualificacao_perguntas qp
  GROUP BY qp.qualificador_id
)
UPDATE public.qualificadores q
SET
  pontuacao_maxima = s.max_total,
  limite_frio_max = FLOOR(s.max_total::numeric / 3)::integer,
  limite_morno_max = FLOOR(2 * s.max_total::numeric / 3)::integer
FROM somas s
WHERE q.id = s.qualificador_id
  AND (q.pontuacao_maxima IS NULL OR q.limite_frio_max IS NULL OR q.limite_morno_max IS NULL);

-- 3. Atualizar view v_qualificacao_sdr para incluir limites do qualificador
-- Colunas novas no final para evitar erro "cannot change name of view column" no CREATE OR REPLACE
DROP VIEW IF EXISTS public.v_qualificacao_sdr;
CREATE VIEW public.v_qualificacao_sdr AS
SELECT
  q.company_id,
  q.id AS qualificador_id,
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
GROUP BY q.id, q.company_id, q.pontuacao_maxima, q.limite_frio_max, q.limite_morno_max,
  qp.id, qp.pergunta, qp.peso, qp.ordem;
