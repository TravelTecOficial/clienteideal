-- RLS para ideal_customers (compatível com Clerk + profiles)
-- Padrão: isolamento por company_id via profiles

DROP POLICY IF EXISTS "Users can view their company ideal_customers" ON ideal_customers;
CREATE POLICY "Users can view their company ideal_customers" ON ideal_customers
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can insert company ideal_customers" ON ideal_customers;
CREATE POLICY "Users can insert company ideal_customers" ON ideal_customers
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

DROP POLICY IF EXISTS "Users can update company ideal_customers" ON ideal_customers;
CREATE POLICY "Users can update company ideal_customers" ON ideal_customers
  FOR UPDATE USING ((auth.jwt() ->> 'sub') = user_id);

DROP POLICY IF EXISTS "Users can delete company ideal_customers" ON ideal_customers;
CREATE POLICY "Users can delete company ideal_customers" ON ideal_customers
  FOR DELETE USING ((auth.jwt() ->> 'sub') = user_id);
