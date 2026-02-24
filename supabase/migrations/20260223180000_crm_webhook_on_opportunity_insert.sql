-- Webhook CRM: dispara também na CRIAÇÃO de oportunidade (além da mudança de estágio).
-- Reutiliza a mesma lógica de payload (id_lead, external_id, stage).

CREATE OR REPLACE FUNCTION public.notify_crm_webhook_on_opportunity_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_external_id text;
  v_body jsonb;
BEGIN
  -- Busca external_id do lead quando lead_id existe
  IF NEW.lead_id IS NOT NULL THEN
    SELECT external_id INTO v_external_id
    FROM public.leads
    WHERE id = NEW.lead_id
    LIMIT 1;
  ELSE
    v_external_id := NULL;
  END IF;

  v_body := jsonb_build_object(
    'id_lead', NEW.lead_id,
    'external_id', v_external_id,
    'stage', NEW.stage::text
  );

  -- Envia POST assíncrono ao webhook (executa após commit)
  PERFORM net.http_post(
    url := 'https://jobs.traveltec.com.br/webhook/crm',
    body := v_body,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_opportunities_notify_crm_webhook_on_insert
  AFTER INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_crm_webhook_on_opportunity_insert();
