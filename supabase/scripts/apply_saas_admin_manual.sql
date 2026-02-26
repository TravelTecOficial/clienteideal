-- Script para aplicar saas_admin manualmente (quando a migração não foi aplicada).
-- Execute no Supabase SQL Editor.
--
-- 1. Adiciona a coluna saas_admin
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saas_admin boolean NOT NULL DEFAULT false;

-- 2. Função que verifica se o usuário é admin do SaaS
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

-- 3. Atualiza política de LEADS para permitir saas_admin
DROP POLICY IF EXISTS "Users can view company leads" ON leads;
CREATE POLICY "Users can view company leads" ON leads
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can update company leads" ON leads;
CREATE POLICY "Users can update company leads" ON leads
  FOR UPDATE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- 4. Outras tabelas usadas no dashboard
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
CREATE POLICY "Users can view their own company" ON companies
  FOR SELECT USING (
    public.is_saas_admin()
    OR id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can view their company items" ON items;
CREATE POLICY "Users can view their company items" ON items
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can view company vendedores" ON vendedores;
CREATE POLICY "Users can view company vendedores" ON vendedores
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can view their company ideal_customers" ON ideal_customers;
CREATE POLICY "Users can view their company ideal_customers" ON ideal_customers
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can view company opportunities" ON opportunities;
CREATE POLICY "Users can view company opportunities" ON opportunities
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Visualização por company_id" ON qualificadores;
CREATE POLICY "Visualização por company_id" ON qualificadores
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- 5. Marca seu usuário como admin (use seu email)
UPDATE profiles
SET saas_admin = true
WHERE email = 'clienteidealonline@gmail.com';

-- 6. Verifica se funcionou
SELECT id, email, full_name, saas_admin FROM profiles WHERE email = 'clienteidealonline@gmail.com';
