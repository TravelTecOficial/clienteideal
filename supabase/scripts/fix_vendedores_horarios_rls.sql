-- Execute no Supabase Dashboard > SQL Editor (projeto de produção)
-- Corrige RLS de vendedores e horarios_vendedor: INSERT/UPDATE/DELETE com is_saas_admin().
-- Erro: "new row violates row-level security policy for table vendedores" ou "horarios_vendedor".
-- Garante que is_saas_admin() e coluna saas_admin existam antes de criar as políticas.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saas_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_saas_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT saas_admin FROM profiles WHERE id = (auth.jwt() ->> 'sub')),
    false
  );
$$;

-- VENDEDORES: remove todas as políticas de INSERT/UPDATE/DELETE (por nome no catálogo)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendedores' AND cmd IN ('INSERT', 'UPDATE', 'DELETE'))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.vendedores', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can insert company vendedores" ON public.vendedores
  FOR INSERT WITH CHECK (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can update company vendedores" ON public.vendedores
  FOR UPDATE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can delete company vendedores" ON public.vendedores
  FOR DELETE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- HORARIOS_VENDEDOR: remove TODAS as políticas de INSERT/UPDATE/DELETE (por nome no catálogo)
-- para evitar políticas antigas ou com outro nome bloqueando em produção.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'horarios_vendedor' AND cmd IN ('INSERT', 'UPDATE', 'DELETE'))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.horarios_vendedor', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can insert company horarios_vendedor" ON public.horarios_vendedor
  FOR INSERT WITH CHECK (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can update company horarios_vendedor" ON public.horarios_vendedor
  FOR UPDATE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can delete company horarios_vendedor" ON public.horarios_vendedor
  FOR DELETE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- RPC que grava vendedor + horários com SECURITY DEFINER (contorna RLS; use se 403 continuar)
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

GRANT EXECUTE ON FUNCTION public.save_vendedor_horarios TO anon;
GRANT EXECUTE ON FUNCTION public.save_vendedor_horarios TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_vendedor_horarios TO service_role;
