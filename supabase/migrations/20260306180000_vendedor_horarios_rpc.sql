-- RPC para salvar vendedor + horários com SECURITY DEFINER (contorna RLS).
-- Resolve 403 em produção quando políticas RLS continuam bloqueando horarios_vendedor.

CREATE OR REPLACE FUNCTION public.save_vendedor_horarios(
  p_email text,
  p_company_id text,
  p_nome text,
  p_celular text,
  p_status boolean,
  p_is_edit boolean,
  p_vendedor_id text,
  p_horarios jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_write boolean;
  h jsonb;
BEGIN
  -- Autorização: saas_admin ou usuário com profile na mesma empresa
  v_can_write := public.is_saas_admin()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (auth.jwt() ->> 'sub')
        AND company_id = p_company_id
        AND company_id IS NOT NULL
    );
  IF NOT v_can_write THEN
    RAISE EXCEPTION 'Não autorizado a gravar vendedor/horários para esta empresa.'
      USING errcode = '42501';
  END IF;

  IF p_is_edit THEN
    UPDATE vendedores
    SET nome = COALESCE(NULLIF(trim(p_nome), ''), nome),
        celular = p_celular,
        status = p_status
    WHERE email = p_email AND company_id = p_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vendedor não encontrado para atualização.'
        USING errcode = 'P0002';
    END IF;
  ELSE
    INSERT INTO vendedores (id, email, company_id, nome, celular, status)
    VALUES (
      p_vendedor_id,
      p_email,
      p_company_id,
      COALESCE(NULLIF(trim(p_nome), ''), ''),
      p_celular,
      p_status
    );
  END IF;

  DELETE FROM horarios_vendedor
  WHERE vendedor_email = p_email AND company_id = p_company_id;

  FOR h IN SELECT * FROM jsonb_array_elements(p_horarios)
  LOOP
    INSERT INTO horarios_vendedor (vendedor_email, company_id, dia_semana, entrada, saida)
    VALUES (
      p_email,
      p_company_id,
      (h->>'dia_semana')::int,
      (NULLIF(trim(h->>'entrada'), ''))::time,
      (NULLIF(trim(h->>'saida'), ''))::time
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.save_vendedor_horarios IS 'Grava vendedor e horários; usa SECURITY DEFINER para contornar RLS. Valida permissão via is_saas_admin() ou profile.company_id.';

-- Permite chamada com JWT do cliente (role anon/authenticated)
GRANT EXECUTE ON FUNCTION public.save_vendedor_horarios TO anon;
GRANT EXECUTE ON FUNCTION public.save_vendedor_horarios TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_vendedor_horarios TO service_role;
