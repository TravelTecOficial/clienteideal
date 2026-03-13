-- Campo para controlar se a automação usa a IA de SDR (qualificação)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS use_sdr boolean DEFAULT true;

COMMENT ON COLUMN public.companies.use_sdr IS 'Se true, a automação usa a IA de SDR para qualificação. Se false, não usa.';
