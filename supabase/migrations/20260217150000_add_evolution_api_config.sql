-- Adiciona colunas para configuração da Evolution API (WhatsApp) em companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS evolution_api_url text,
  ADD COLUMN IF NOT EXISTS evolution_api_key text,
  ADD COLUMN IF NOT EXISTS evolution_instance_name text;
