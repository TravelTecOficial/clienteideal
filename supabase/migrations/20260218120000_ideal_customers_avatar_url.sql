-- Coluna para URL do avatar/rosto gerado por IA (Stability AI)
ALTER TABLE public.ideal_customers
ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.ideal_customers.avatar_url IS 'URL pública da imagem do rosto gerada por IA (Stability AI)';
