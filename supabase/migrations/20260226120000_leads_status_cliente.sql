-- Status "Cliente" no lead: quando oportunidade converte (stage=ganho), lead passa a Cliente.
-- Facilita ações de pós-venda e comunicação.

-- 1. Alterar constraint de status em leads (incluir 'Cliente')
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('Novo', 'Em Contato', 'Qualificado', 'Perdido', 'Cliente'));

-- 2. Função: atualiza lead para status Cliente quando oportunidade converte
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
    SET status = 'Cliente'
    WHERE id = NEW.lead_id;
    RETURN NEW;
  END IF;

  -- UPDATE: stage mudou para 'ganho' e lead_id presente
  IF TG_OP = 'UPDATE' AND NEW.stage = 'ganho' AND NEW.lead_id IS NOT NULL
     AND (OLD.stage IS DISTINCT FROM 'ganho') THEN
    UPDATE public.leads
    SET status = 'Cliente'
    WHERE id = NEW.lead_id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Triggers
CREATE TRIGGER trg_opportunities_set_lead_cliente_on_insert
  AFTER INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lead_cliente_on_opportunity_ganho();

CREATE TRIGGER trg_opportunities_set_lead_cliente_on_update
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lead_cliente_on_opportunity_ganho();
