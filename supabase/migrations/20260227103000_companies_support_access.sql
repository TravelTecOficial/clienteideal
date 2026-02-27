-- Controle de acesso de suporte por licença
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS support_access_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.companies.support_access_enabled IS
  'Quando true, o suporte da Cliente Ideal pode acessar a licença via modo preview.';
