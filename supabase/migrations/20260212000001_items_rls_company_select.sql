-- Permitir que usuários vejam todos os itens da sua empresa (via profiles.company_id)
-- A política anterior exigia company_id no JWT; esta usa subquery em profiles.

DROP POLICY IF EXISTS "Users can view their company items" ON items;
CREATE POLICY "Users can view their company items" ON items FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub')
    AND company_id IS NOT NULL
  )
);
