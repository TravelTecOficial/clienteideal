-- Adiciona categoria GMB (Google Meu Negócio) para busca de concorrentes
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS gmb_place_type text;

COMMENT ON COLUMN public.companies.gmb_place_type IS 'Tipo do Google Places (ex: real_estate_agency, dentist) para buscar concorrentes na aba Explorar do GMB Local.';
