-- Webhook CRM: envia id_lead, external_id e stage para jobs.traveltec.com.br
-- sempre que o estágio de uma oportunidade for alterado (Kanban ou formulário).
--
-- Pré-requisito: habilitar pg_net em Database > Extensions no Supabase Dashboard.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_crm_webhook_on_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_external_id text;
  v_body jsonb;
BEGIN
  -- Só executa quando o estágio mudou
  IF OLD.stage IS NOT DISTINCT FROM NEW.stage THEN
    RETURN NEW;
  END IF;

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

CREATE TRIGGER trg_opportunities_notify_crm_webhook
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_crm_webhook_on_stage_change();
