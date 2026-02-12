-- Atualizar políticas items para Clerk (IDs string)
-- auth.uid()::text falha com IDs Clerk (user_xxx). Usar auth.jwt() ->> 'sub'.

DROP POLICY IF EXISTS "Users can view their company items" ON items;
CREATE POLICY "Users can view their company items" ON items FOR SELECT USING (
  (auth.jwt() ->> 'sub') = user_id
  OR (auth.jwt() ->> 'company_id') = company_id
);

DROP POLICY IF EXISTS "Users can insert company items" ON items;
CREATE POLICY "Users can insert company items" ON items FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

DROP POLICY IF EXISTS "Users can update company items" ON items;
CREATE POLICY "Users can update company items" ON items FOR UPDATE
  USING ((auth.jwt() ->> 'sub') = user_id);

DROP POLICY IF EXISTS "Users can delete company items" ON items;
CREATE POLICY "Users can delete company items" ON items FOR DELETE
  USING ((auth.jwt() ->> 'sub') = user_id);
