-- Execute no Supabase Dashboard > SQL Editor (se a migration não foi aplicada)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS gmb_place_type text;

COMMENT ON COLUMN public.companies.gmb_place_type IS 'Tipo do Google Places (ex: real_estate_agency, dentist) para buscar concorrentes.';
