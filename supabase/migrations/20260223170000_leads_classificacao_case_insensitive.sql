-- Tornar constraint de classificacao case-insensitive (aceita Frio/frio, Morno/morno, Quente/quente)
-- Corrige erro ao atualizar leads via N8N/API que enviam valores em minúsculo
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_classificacao_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_classificacao_check
  CHECK (classificacao IS NULL OR LOWER(TRIM(classificacao)) IN ('frio', 'morno', 'quente'));
