-- Corrige RLS de opportunities: garante que UPDATE permita is_saas_admin() e
-- que usuários com profile.company_id possam atualizar oportunidades da própria empresa.
-- Resolve "Nenhuma linha atualizada" ao editar oportunidades no modal.

-- Garantir coluna saas_admin existe
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saas_admin boolean NOT NULL DEFAULT false;

-- Garantir função is_saas_admin()
CREATE OR REPLACE FUNCTION public.is_saas_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT saas_admin FROM profiles WHERE id = (auth.jwt() ->> 'sub')),
    false
  );
$$;

-- Recriar política de UPDATE para opportunities (idempotente)
DROP POLICY IF EXISTS "Users can update company opportunities" ON opportunities;
CREATE POLICY "Users can update company opportunities" ON opportunities
  FOR UPDATE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );
