-- Adicionar coluna classificacao (Frio, Morno, Quente) na tabela leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS classificacao text;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_classificacao_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_classificacao_check
  CHECK (classificacao IS NULL OR classificacao IN ('Frio', 'Morno', 'Quente'));
