-- Reparo de drift: garante avatar_url em ideal_customers em ambientes
-- onde a migration 20260218120000 foi marcada como aplicada sem executar SQL.
ALTER TABLE public.ideal_customers
ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.ideal_customers.avatar_url IS 'URL pública da imagem do rosto gerada por IA (Stability AI)';
