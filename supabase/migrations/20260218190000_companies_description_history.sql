-- Adiciona colunas para informações básicas da empresa (nome já existe)
-- description = apresentação da empresa
-- history = histórico da empresa
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS history text;

COMMENT ON COLUMN public.companies.description IS 'Apresentação da empresa (texto descritivo)';
COMMENT ON COLUMN public.companies.history IS 'Histórico da empresa';
