-- RPC update_opportunity com parâmetro único JSONB (evita problemas de schema cache).
-- Verifica permissão (is_saas_admin ou company_id do profile) antes de atualizar.

CREATE OR REPLACE FUNCTION public.update_opportunity(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_company_id text;
  v_can_update boolean;
BEGIN
  v_id := (payload->>'id')::uuid;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ID da oportunidade é obrigatório');
  END IF;

  SELECT o.company_id INTO v_company_id
  FROM opportunities o
  WHERE o.id = v_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oportunidade não encontrada');
  END IF;

  v_can_update := public.is_saas_admin()
    OR v_company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    );

  IF NOT v_can_update THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para atualizar esta oportunidade');
  END IF;

  UPDATE opportunities
  SET
    title = COALESCE(NULLIF(trim(payload->>'title'), ''), title),
    value = COALESCE((payload->>'value')::numeric, value),
    expected_closing_date = CASE WHEN NULLIF(trim(payload->>'expected_closing_date'), '') IS NOT NULL THEN (payload->>'expected_closing_date')::date ELSE expected_closing_date END,
    stage = CASE WHEN NULLIF(trim(payload->>'stage'), '') IS NOT NULL THEN (payload->>'stage')::opportunity_stage ELSE stage END,
    lead_id = CASE WHEN NULLIF(trim(payload->>'lead_id'), '') IS NOT NULL THEN (payload->>'lead_id')::uuid ELSE NULL END,
    seller_id = CASE WHEN NULLIF(trim(payload->>'seller_id'), '') IS NOT NULL THEN (payload->>'seller_id')::text ELSE NULL END,
    product_id = CASE WHEN NULLIF(trim(payload->>'product_id'), '') IS NOT NULL THEN (payload->>'product_id')::uuid ELSE NULL END,
    sinopse = CASE WHEN NULLIF(trim(payload->>'sinopse'), '') IS NOT NULL THEN (payload->>'sinopse')::text ELSE NULL END
  WHERE id = v_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oportunidade não encontrada');
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- Remover função antiga (assinatura múltiplos params) se existir
DROP FUNCTION IF EXISTS public.update_opportunity(uuid, text, numeric, date, text, uuid, text, uuid, text);

GRANT EXECUTE ON FUNCTION public.update_opportunity(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_opportunity(jsonb) TO service_role;
