-- Adicionar colunas pontuacao (numérico) e questionario (JSON) na tabela leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS pontuacao numeric;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS questionario jsonb;

COMMENT ON COLUMN public.leads.pontuacao IS 'Pontuação numérica do lead (ex.: score de qualificação)';
COMMENT ON COLUMN public.leads.questionario IS 'Respostas do questionário de qualificação em formato JSON';
