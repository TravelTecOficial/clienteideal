-- As políticas profiles_clerk_policy e companies_clerk_policy usam auth.uid()::text.
-- auth.uid() falha com IDs Clerk (user_xxx) pois tenta converter para UUID.
-- Remover essas políticas e garantir que só existam as que usam auth.jwt() ->> 'sub'.

-- PROFILES: remover política que usa auth.uid()
DROP POLICY IF EXISTS "profiles_clerk_policy" ON profiles;

-- Garantir que as políticas corretas existam
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = (auth.jwt() ->> 'sub'));

-- COMPANIES: remover política que usa auth.uid()
DROP POLICY IF EXISTS "companies_clerk_policy" ON companies;

-- Garantir que as políticas corretas existam (acesso via profiles.company_id)
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
