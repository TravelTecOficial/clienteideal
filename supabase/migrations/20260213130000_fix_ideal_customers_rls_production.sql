-- Fix: Produção tinha políticas RLS antigas (auth.uid()) incompatíveis com Clerk.
-- Clerk usa IDs string (user_xxx); auth.uid() espera UUID e falha → erro 400.
-- Esta migração garante políticas corretas em qualquer ambiente.

-- Remover políticas antigas (nomes em português - produção)
DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON ideal_customers;
DROP POLICY IF EXISTS "Usuários deletam dados da própria empresa" ON ideal_customers;
DROP POLICY IF EXISTS "Usuários veem dados da própria empresa" ON ideal_customers;

-- Remover políticas do padrão dev (caso existam)
DROP POLICY IF EXISTS "Users can view their company ideal_customers" ON ideal_customers;
DROP POLICY IF EXISTS "Users can insert company ideal_customers" ON ideal_customers;
DROP POLICY IF EXISTS "Users can update company ideal_customers" ON ideal_customers;
DROP POLICY IF EXISTS "Users can delete company ideal_customers" ON ideal_customers;

-- Criar políticas corretas (auth.jwt() ->> 'sub' = Clerk user ID)
CREATE POLICY "Users can view their company ideal_customers" ON ideal_customers
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can insert company ideal_customers" ON ideal_customers
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users can update company ideal_customers" ON ideal_customers
  FOR UPDATE USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users can delete company ideal_customers" ON ideal_customers
  FOR DELETE USING ((auth.jwt() ->> 'sub') = user_id);
