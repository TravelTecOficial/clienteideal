-- RPC para atualizar oportunidade, contornando problemas de RLS.
-- Verifica permissão (is_saas_admin ou company_id do profile) antes de atualizar.

CREATE OR REPLACE FUNCTION public.update_opportunity(
  p_id uuid,
  p_title text,
  p_value numeric,
  p_expected_closing_date date,
  p_stage text,
  p_lead_id uuid,
  p_seller_id text,
  p_product_id uuid,
  p_sinopse text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id text;
  v_can_update boolean;
  v_updated jsonb;
BEGIN
  -- Obter company_id da oportunidade
  SELECT o.company_id INTO v_company_id
  FROM opportunities o
  WHERE o.id = p_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oportunidade não encontrada');
  END IF;

  -- Verificar permissão: saas_admin OU company_id do profile
  v_can_update := public.is_saas_admin()
    OR v_company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    );

  IF NOT v_can_update THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para atualizar esta oportunidade');
  END IF;

  -- Atualizar
  UPDATE opportunities
  SET
    title = COALESCE(p_title, title),
    value = COALESCE(p_value, value),
    expected_closing_date = p_expected_closing_date,
    stage = CASE WHEN p_stage IS NOT NULL AND p_stage <> '' THEN p_stage::opportunity_stage ELSE stage END,
    lead_id = p_lead_id,
    seller_id = p_seller_id,
    product_id = p_product_id,
    sinopse = p_sinopse
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oportunidade não encontrada');
  END IF;

  RETURN jsonb_build_object('success', true, 'id', p_id);
END;
$$;
