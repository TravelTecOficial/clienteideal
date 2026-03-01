-- Adiciona gmb_place_id em companies para armazenar Place ID do Google Maps
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS gmb_place_id text;

COMMENT ON COLUMN public.companies.gmb_place_id IS 'Place ID do Google Maps (ex: ChIJ...) obtido ao identificar via link. Usado para buscar categoria (primaryType) automaticamente.';
