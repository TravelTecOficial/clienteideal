-- Execute no Supabase Dashboard > SQL Editor (projeto mrkvvgofjyvlutqpvedt)
-- Corrige erro 42703: "column ideal_customers.prompt_atendimento_id does not exist"
-- Esta migration deve ter sido aplicada por 20260228120000_qualificador_prompt_persona_relacionamento.sql

-- 1. ideal_customers: adicionar prompt_atendimento_id
ALTER TABLE public.ideal_customers
  ADD COLUMN IF NOT EXISTS prompt_atendimento_id uuid REFERENCES public.prompt_atendimento(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.ideal_customers.prompt_atendimento_id IS 'Prompt de atendimento associado a este persona. Seleção feita no formulário do Persona.';

-- Backfill: para cada prompt_atendimento com persona_id, atualizar ideal_customers
UPDATE public.ideal_customers ic
SET prompt_atendimento_id = pa.id
FROM public.prompt_atendimento pa
WHERE pa.persona_id = ic.id
  AND pa.company_id = ic.company_id
  AND ic.prompt_atendimento_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ideal_customers_prompt_atendimento
  ON public.ideal_customers(prompt_atendimento_id);
