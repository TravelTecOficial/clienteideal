-- Corrige RLS de vendedores: INSERT/UPDATE/DELETE não tinham is_saas_admin().
-- Erro em produção: "new row violates row-level security policy for table vendedores".
-- Causa: a migração saas_admin_preview_rls só alterou SELECT; usuário em preview
-- ou perfil sem company_id fazia a condição falhar no INSERT.
-- Inclui is_saas_admin() para permitir admins do SaaS inserir/atualizar/excluir
-- vendedores de qualquer empresa (preview) e garante que a política exista.

DROP POLICY IF EXISTS "Users can insert company vendedores" ON vendedores;
CREATE POLICY "Users can insert company vendedores" ON vendedores
  FOR INSERT WITH CHECK (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can update company vendedores" ON vendedores;
CREATE POLICY "Users can update company vendedores" ON vendedores
  FOR UPDATE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can delete company vendedores" ON vendedores;
CREATE POLICY "Users can delete company vendedores" ON vendedores
  FOR DELETE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- HORARIOS_VENDEDOR: mesma correção para INSERT/UPDATE/DELETE (cadastro de vendedor inclui horários)
DROP POLICY IF EXISTS "Users can insert company horarios_vendedor" ON horarios_vendedor;
CREATE POLICY "Users can insert company horarios_vendedor" ON horarios_vendedor
  FOR INSERT WITH CHECK (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can update company horarios_vendedor" ON horarios_vendedor;
CREATE POLICY "Users can update company horarios_vendedor" ON horarios_vendedor
  FOR UPDATE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can delete company horarios_vendedor" ON horarios_vendedor;
CREATE POLICY "Users can delete company horarios_vendedor" ON horarios_vendedor
  FOR DELETE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );
