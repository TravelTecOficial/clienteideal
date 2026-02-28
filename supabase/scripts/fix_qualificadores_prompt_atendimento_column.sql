-- Execute no Supabase Dashboard > SQL Editor (projeto mrkvvgofjyvlutqpvedt)
-- Corrige erro: "column qualificadores.prompt_atendimento_id does not exist"
-- Esta migration deve ter sido aplicada por 20260228120000_qualificador_prompt_persona_relacionamento.sql

-- 1. qualificadores: adicionar prompt_atendimento_id
ALTER TABLE public.qualificadores
  ADD COLUMN IF NOT EXISTS prompt_atendimento_id uuid REFERENCES public.prompt_atendimento(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.qualificadores.prompt_atendimento_id IS 'Prompt de atendimento ao qual este qualificador está vinculado.';

-- 2. Backfill: para qualificadores com ideal_customer_id (schema legado), localizar prompt_atendimento correspondente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'qualificadores' AND column_name = 'ideal_customer_id'
  ) THEN
    UPDATE public.qualificadores q
    SET prompt_atendimento_id = pa.id
    FROM public.prompt_atendimento pa
    WHERE pa.persona_id = q.ideal_customer_id
      AND pa.company_id = q.company_id
      AND q.prompt_atendimento_id IS NULL
      AND q.ideal_customer_id IS NOT NULL;
  END IF;
END $$;

-- 3. Índice para consultas
CREATE INDEX IF NOT EXISTS idx_qualificadores_prompt_atendimento
  ON public.qualificadores(prompt_atendimento_id);
