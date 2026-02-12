-- Alterar user_id de uuid para text para compatibilidade com Clerk (IDs string user_xxx)
ALTER TABLE qualificacoes ALTER COLUMN user_id TYPE text USING user_id::text;
