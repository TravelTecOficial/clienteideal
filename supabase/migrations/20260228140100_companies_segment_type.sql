-- Garante que companies tenha segment_type (usado por evolution-webhook, chat-conhecimento-proxy)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS segment_type text;

COMMENT ON COLUMN public.companies.segment_type IS 'Segmento da empresa: produtos ou consorcio. Usado para escolher webhook N8N.';
