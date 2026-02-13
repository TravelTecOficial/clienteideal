-- Oportunidades: adicionar lead_id e remover ideal_customer_id (opcional - manter coluna por compatibilidade)
-- Agenda: alterar vendedor_id para referenciar vendedores em vez de profiles

-- Oportunidades: adicionar lead_id
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

-- Agenda: alterar vendedor_id para referenciar vendedores (não profiles)
-- vendedor_id pode ser: uuid (initial_schema) ou text REFERENCES profiles (create_agenda)

-- 1. Remover FK antiga (se existir)
ALTER TABLE public.agenda
  DROP CONSTRAINT IF EXISTS agenda_vendedor_id_fkey;

-- 2. Se vendedor_id for text, converter para uuid (profile IDs ficam NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'vendedor_id'
    AND data_type = 'text'
  ) THEN
    UPDATE public.agenda SET vendedor_id = NULL WHERE vendedor_id IS NOT NULL;
    ALTER TABLE public.agenda ALTER COLUMN vendedor_id TYPE uuid USING NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'agenda vendedor_id alteração: %', SQLERRM;
END $$;

-- 3. Adicionar FK para vendedores (ignorar se já existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agenda_vendedor_id_fkey'
  ) THEN
    ALTER TABLE public.agenda
      ADD CONSTRAINT agenda_vendedor_id_fkey
      FOREIGN KEY (vendedor_id) REFERENCES public.vendedores(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'agenda FK vendedores: %', SQLERRM;
END $$;
