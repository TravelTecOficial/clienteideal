-- Remove trigger(s) na tabela agenda que auto-inserem em opportunities.
-- Esses triggers causam falha "null title" porque a tabela agenda não tem coluna title.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'agenda'
      AND NOT t.tgisinternal
  LOOP
    RAISE NOTICE 'Dropping trigger % on agenda', r.tgname;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.agenda', r.tgname);
  END LOOP;
END $$;
