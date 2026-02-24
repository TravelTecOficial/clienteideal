-- Corrige erro "record new has no field updated_at" (42703).
-- A tabela prompt_templates pode ter sido criada sem updated_at (ex: CREATE TABLE IF NOT EXISTS
-- quando a tabela já existia com schema antigo). O trigger set_updated_at exige essa coluna.

ALTER TABLE public.prompt_templates
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

ALTER TABLE public.prompt_template_stages
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());
