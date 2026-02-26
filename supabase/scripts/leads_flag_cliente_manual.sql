/*
  Flag is_cliente no lead
  Quando uma oportunidade atinge stage='ganho', o lead vinculado recebe is_cliente=true.
  Duas visões: Leads (is_cliente=false) e Clientes (is_cliente=true).

  Execute no Supabase: SQL Editor > New query > Cole e rode.
*/

-- 1. Adicionar coluna is_cliente (se não existir)
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

-- 4. Função: setar is_cliente=true quando oportunidade converte
CREATE OR REPLACE FUNCTION public.set_lead_cliente_on_opportunity_ganho()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.stage = 'ganho' AND NEW.lead_id IS NOT NULL THEN
    UPDATE public.leads SET is_cliente = true WHERE id = NEW.lead_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.stage = 'ganho' AND NEW.lead_id IS NOT NULL
     AND (OLD.stage IS DISTINCT FROM 'ganho') THEN
    UPDATE public.leads SET is_cliente = true WHERE id = NEW.lead_id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Triggers (criar se não existirem)
DROP TRIGGER IF EXISTS trg_opportunities_set_lead_cliente_on_insert ON public.opportunities;
CREATE TRIGGER trg_opportunities_set_lead_cliente_on_insert
  AFTER INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lead_cliente_on_opportunity_ganho();

DROP TRIGGER IF EXISTS trg_opportunities_set_lead_cliente_on_update ON public.opportunities;
CREATE TRIGGER trg_opportunities_set_lead_cliente_on_update
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lead_cliente_on_opportunity_ganho();
