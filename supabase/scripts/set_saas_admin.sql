-- Script para marcar um usuário como admin do SaaS (permite preview de clientes).
-- Execute após a migração 20260226200000_saas_admin_preview_rls.sql.
--
-- IMPORTANTE: Substitua 'user_XXXXXXXX' pelo Clerk User ID do admin (ex: user_2abc123...).
-- O ID pode ser obtido no painel Clerk: Users > [usuário] > User ID.
--
-- Para admins existentes (criados antes desta migração), execute este script
-- manualmente. Novos admins com publicMetadata.role === "admin" no Clerk
-- serão sincronizados automaticamente pelo webhook (user.created e user.updated).
--
-- No Clerk Dashboard, adicione o evento "user.updated" ao webhook para que
-- alterações em publicMetadata.role sejam refletidas no Supabase.

UPDATE profiles
SET saas_admin = true
WHERE id = 'user_XXXXXXXX'  -- Substituir pelo Clerk User ID do admin
  AND saas_admin = false;
