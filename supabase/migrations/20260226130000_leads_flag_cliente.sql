/* Flag is_cliente no lead: quando oportunidade converte (stage=ganho), lead recebe is_cliente=true.
   Mantém status originais (Novo, Em Contato, Qualificado, Perdido). Duas visões: Leads e Clientes. */

-- 1. Adicionar coluna is_cliente
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_cliente boolean NOT NULL DEFAULT false;

-- 2. Migrar leads com status 'Cliente' para is_cliente=true e status 'Qualificado'
UPDATE public.leads
SET is_cliente = true, status = 'Qualificado'
WHERE status = 'Cliente';

-- 3. Reverter constraint de status (remover 'Cliente')
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('Novo', 'Em Contato', 'Qualificado', 'Perdido'));

-- 4. Ajustar função: setar is_cliente = true em vez de status = 'Cliente'
CREATE OR REPLACE FUNCTION public.set_lead_cliente_on_opportunity_ganho()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT: stage = 'ganho' e lead_id presente
  IF TG_OP = 'INSERT' AND NEW.stage = 'ganho' AND NEW.lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET is_cliente = true
    WHERE id = NEW.lead_id;
    RETURN NEW;
  END IF;

  -- UPDATE: stage mudou para 'ganho' e lead_id presente
  IF TG_OP = 'UPDATE' AND NEW.stage = 'ganho' AND NEW.lead_id IS NOT NULL
     AND (OLD.stage IS DISTINCT FROM 'ganho') THEN
    UPDATE public.leads
    SET is_cliente = true
    WHERE id = NEW.lead_id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
