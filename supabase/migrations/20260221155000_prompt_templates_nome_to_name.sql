-- Renomeia nome para name em prompt_templates (compatibilidade com admin/dashboard).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prompt_templates' AND column_name = 'nome'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prompt_templates' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.prompt_templates RENAME COLUMN nome TO name;
  END IF;
END $$;
