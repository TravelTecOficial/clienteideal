-- RLS para leads e vendedores (compatível com Clerk + profiles)
-- Padrão: isolamento por company_id via profiles

-- LEADS
DROP POLICY IF EXISTS "Users can view company leads" ON leads;
CREATE POLICY "Users can view company leads" ON leads
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can insert company leads" ON leads;
CREATE POLICY "Users can insert company leads" ON leads
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can update company leads" ON leads;
CREATE POLICY "Users can update company leads" ON leads
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can delete company leads" ON leads;
CREATE POLICY "Users can delete company leads" ON leads
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- VENDEDORES
DROP POLICY IF EXISTS "Users can view company vendedores" ON vendedores;
CREATE POLICY "Users can view company vendedores" ON vendedores
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can insert company vendedores" ON vendedores;
CREATE POLICY "Users can insert company vendedores" ON vendedores
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can update company vendedores" ON vendedores;
CREATE POLICY "Users can update company vendedores" ON vendedores
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can delete company vendedores" ON vendedores;
CREATE POLICY "Users can delete company vendedores" ON vendedores
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- HORARIOS_VENDEDOR
DROP POLICY IF EXISTS "Users can view company horarios_vendedor" ON horarios_vendedor;
CREATE POLICY "Users can view company horarios_vendedor" ON horarios_vendedor
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can insert company horarios_vendedor" ON horarios_vendedor;
CREATE POLICY "Users can insert company horarios_vendedor" ON horarios_vendedor
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can update company horarios_vendedor" ON horarios_vendedor;
CREATE POLICY "Users can update company horarios_vendedor" ON horarios_vendedor
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can delete company horarios_vendedor" ON horarios_vendedor;
CREATE POLICY "Users can delete company horarios_vendedor" ON horarios_vendedor
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );
