-- Oportunidades: adicionar coluna sinopse (usada quando segment_type = consorcio)
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS sinopse text;
