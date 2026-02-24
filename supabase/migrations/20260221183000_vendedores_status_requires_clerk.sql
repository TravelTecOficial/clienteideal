-- Regra de negocio: vendedor so pode ficar ativo apos registrar no Clerk.
-- Seguranca: validacao no banco para nao depender apenas do frontend.

-- Novos vendedores iniciam inativos por padrao.
ALTER TABLE public.vendedores
  ALTER COLUMN status SET DEFAULT false;

-- Dados existentes sem vinculo Clerk devem ficar inativos.
UPDATE public.vendedores
SET status = false
WHERE clerk_id IS NULL
  AND status IS DISTINCT FROM false;

-- Impede status=true quando ainda nao existe clerk_id.
ALTER TABLE public.vendedores
  DROP CONSTRAINT IF EXISTS vendedores_status_requires_clerk_check;

ALTER TABLE public.vendedores
  ADD CONSTRAINT vendedores_status_requires_clerk_check
  CHECK (status IS NOT TRUE OR clerk_id IS NOT NULL);
