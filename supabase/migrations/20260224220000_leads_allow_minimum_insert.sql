-- Permite cadastro mínimo de lead no primeiro contato (sem user_id e sem name).
-- Regra de negócio: company_id + external_id + phone já caracterizam lead válido.
ALTER TABLE public.leads
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN name DROP NOT NULL;
