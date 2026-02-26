-- Verifica se o admin do SaaS está configurado corretamente.
-- Execute no Supabase SQL Editor e confira o resultado.

-- 1. Listar perfis com saas_admin = true
SELECT id, email, full_name, company_id, role, saas_admin
FROM profiles
WHERE saas_admin = true;

-- 2. Se não houver nenhum, liste seus usuários para encontrar o ID do admin
SELECT id, email, full_name, company_id, role, saas_admin
FROM profiles
ORDER BY created_at DESC
LIMIT 10;

-- 3. Para marcar um usuário como admin, use (substitua o ID):
-- UPDATE profiles SET saas_admin = true WHERE id = 'user_XXXXXXXX';
