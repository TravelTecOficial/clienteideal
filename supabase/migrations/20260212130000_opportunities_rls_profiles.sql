-- Alinhar RLS de opportunities ao padrão profiles (como leads e items)
-- O RLS anterior usava auth.jwt() ->> 'company_id' que pode não estar no JWT do Clerk

DROP POLICY IF EXISTS "Users can only access their company's opportunities" ON opportunities;

CREATE POLICY "Users can view company opportunities" ON opportunities
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can insert company opportunities" ON opportunities
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can update company opportunities" ON opportunities
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can delete company opportunities" ON opportunities
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );
