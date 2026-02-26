-- Adiciona campos cadastrais estruturados em companies
-- name = Razão Social (existente), nome_fantasia = Nome Fantasia
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS site_oficial text,
  ADD COLUMN IF NOT EXISTS horario_funcionamento text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS linkedin_url text;

COMMENT ON COLUMN public.companies.name IS 'Razão Social da empresa';
COMMENT ON COLUMN public.companies.nome_fantasia IS 'Nome Fantasia da empresa';
COMMENT ON COLUMN public.companies.cnpj IS 'CNPJ (opcional)';
COMMENT ON COLUMN public.companies.logradouro IS 'Logradouro do endereço';
COMMENT ON COLUMN public.companies.numero IS 'Número do endereço';
COMMENT ON COLUMN public.companies.bairro IS 'Bairro';
COMMENT ON COLUMN public.companies.cidade IS 'Cidade';
COMMENT ON COLUMN public.companies.uf IS 'UF (estado)';
COMMENT ON COLUMN public.companies.cep IS 'CEP';
COMMENT ON COLUMN public.companies.site_oficial IS 'Site oficial da empresa';
COMMENT ON COLUMN public.companies.horario_funcionamento IS 'Horário de funcionamento (ex: Segunda a Sexta, 08h às 18h)';
COMMENT ON COLUMN public.companies.instagram_url IS 'URL do perfil Instagram';
COMMENT ON COLUMN public.companies.facebook_url IS 'URL do perfil Facebook';
COMMENT ON COLUMN public.companies.linkedin_url IS 'URL do perfil LinkedIn';
