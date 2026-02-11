-- RLS policies usam auth.uid() que retorna UUID. Com Clerk, o JWT sub é string (ex: user_2abc123).
-- auth.uid() falha ao converter "user_xxx" para UUID. Usar auth.jwt() ->> 'sub' para IDs string.

-- PROFILES: atualizar políticas
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = (auth.jwt() ->> 'sub'));

-- COMPANIES: atualizar políticas (subquery referencia profiles.id)
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
CREATE POLICY "Users can view their own company" ON companies
  FOR SELECT USING (
    id IN (
      SELECT profiles.company_id
      FROM profiles
      WHERE profiles.id = (auth.jwt() ->> 'sub')
    )
  );

DROP POLICY IF EXISTS "Admins can update their company" ON companies;
CREATE POLICY "Admins can update their company" ON companies
  FOR UPDATE USING (
    id IN (
      SELECT profiles.company_id
      FROM profiles
      WHERE profiles.id = (auth.jwt() ->> 'sub') AND profiles.role = 'admin'
    )
  );
