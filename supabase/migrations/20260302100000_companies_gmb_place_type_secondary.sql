-- Adiciona categoria secundária GMB (Google Meu Negócio) para análises futuras
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS gmb_place_type_secondary text;

COMMENT ON COLUMN public.companies.gmb_place_type_secondary IS 'Categoria secundária do Google Places (ex: doctor, health) opcional, usada para análises futuras no GMB Local.';

