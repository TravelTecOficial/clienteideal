-- Padroniza vendedores.id para TEXT (Clerk/Profile IDs) e corrige relacionamentos.
-- Objetivo: eliminar FK 23503 em atendimentos_ia.id_vendedor -> profiles(id).

BEGIN;

-- 0) Views/regras que dependem de vendedores.id (detecção em runtime)
--    Guardamos o SQL da view para recriar após o ALTER TYPE.
CREATE TEMP TABLE IF NOT EXISTS _tmp_vendedor_da_vez_def (
  definition text
) ON COMMIT DROP;

INSERT INTO _tmp_vendedor_da_vez_def(definition)
SELECT pg_get_viewdef('public.vendedor_da_vez'::regclass, true)
WHERE to_regclass('public.vendedor_da_vez') IS NOT NULL;

DROP VIEW IF EXISTS public.vendedor_da_vez;

-- 1) Remove FKs que dependem de vendedores.id para permitir alteração de tipo/mapeamento
ALTER TABLE public.agenda
  DROP CONSTRAINT IF EXISTS agenda_vendedor_id_fkey;

ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_seller_id_fkey;

-- 2) Garante tipo TEXT nas colunas relacionadas
ALTER TABLE public.vendedores
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE public.vendedores
  ALTER COLUMN id TYPE text USING id::text;

ALTER TABLE public.agenda
  ALTER COLUMN vendedor_id TYPE text USING vendedor_id::text;

ALTER TABLE public.opportunities
  ALTER COLUMN seller_id TYPE text USING seller_id::text;

-- 3) Mapeia IDs antigos -> IDs alvo (profiles/clerk), preservando rastreabilidade
CREATE TEMP TABLE IF NOT EXISTS _tmp_vendedores_id_map (
  old_id text PRIMARY KEY,
  new_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO _tmp_vendedores_id_map(old_id, new_id)
SELECT
  v.id AS old_id,
  COALESCE(
    -- prioridade 1: clerk_id válido apontando para profile
    p_by_clerk.id,
    -- prioridade 2: match por email + company_id
    p_by_email.id,
    -- fallback: mantém o ID atual (fica inativo depois se não houver profile)
    v.id
  ) AS new_id
FROM public.vendedores v
LEFT JOIN public.profiles p_by_clerk
  ON v.clerk_id IS NOT NULL
 AND p_by_clerk.id = v.clerk_id
LEFT JOIN public.profiles p_by_email
  ON v.company_id IS NOT NULL
 AND p_by_email.company_id = v.company_id
 AND lower(trim(p_by_email.email)) = lower(trim(v.email));

-- 3.1) Atualiza referências antes de alterar PK lógica de vendedores
UPDATE public.agenda a
SET vendedor_id = m.new_id
FROM _tmp_vendedores_id_map m
WHERE a.vendedor_id = m.old_id
  AND a.vendedor_id IS DISTINCT FROM m.new_id;

UPDATE public.opportunities o
SET seller_id = m.new_id
FROM _tmp_vendedores_id_map m
WHERE o.seller_id = m.old_id
  AND o.seller_id IS DISTINCT FROM m.new_id;

-- 3.2) Atualiza vendedores.id para o ID alvo
UPDATE public.vendedores v
SET id = m.new_id
FROM _tmp_vendedores_id_map m
WHERE v.id = m.old_id
  AND v.id IS DISTINCT FROM m.new_id;

-- 3.3) Sincroniza clerk_id quando ele estiver nulo e houver profile por email
UPDATE public.vendedores v
SET clerk_id = p.id
FROM public.profiles p
WHERE v.clerk_id IS NULL
  AND v.company_id = p.company_id
  AND lower(trim(v.email)) = lower(trim(p.email))
  AND v.id = p.id;

-- 3.4) Validações de integridade pós-mapeamento
DO $$
DECLARE
  v_duplicate_ids integer;
  v_unmapped integer;
BEGIN
  -- Validação: não pode haver colisão de PK após mapeamento
  SELECT count(*)
    INTO v_duplicate_ids
  FROM (
    SELECT id
    FROM public.vendedores
    GROUP BY id
    HAVING count(*) > 1
  ) t;

  IF v_duplicate_ids > 0 THEN
    RAISE EXCEPTION
      'Migração abortada: IDs duplicados em vendedores após mapeamento para profiles (% registros duplicados).',
      v_duplicate_ids;
  END IF;

  -- Validação: vendedores sem profile não podem bloquear a migração.
  -- Eles ficam inativos até serem vinculados ao Clerk/profile.
  SELECT count(*)
    INTO v_unmapped
  FROM public.vendedores v
  LEFT JOIN public.profiles p
    ON p.id = v.id
  WHERE p.id IS NULL;

  IF v_unmapped > 0 THEN
    UPDATE public.vendedores v
    SET status = false
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = v.id
    );

    RAISE NOTICE
      'Aviso: % vendedor(es) sem correspondência em profiles foram mantidos com o ID atual e marcados como inativos (status=false).',
      v_unmapped;
  END IF;
END $$;

-- 4) Recria FKs com tipo TEXT
ALTER TABLE public.agenda
  ADD CONSTRAINT agenda_vendedor_id_fkey
  FOREIGN KEY (vendedor_id) REFERENCES public.vendedores(id) ON DELETE SET NULL;

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES public.vendedores(id) ON DELETE SET NULL;

ALTER TABLE public.atendimentos_ia
  DROP CONSTRAINT IF EXISTS atendimentos_ia_id_vendedor_fkey;

ALTER TABLE public.atendimentos_ia
  ALTER COLUMN id_vendedor TYPE text USING id_vendedor::text;

ALTER TABLE public.atendimentos_ia
  ADD CONSTRAINT atendimentos_ia_id_vendedor_fkey
  FOREIGN KEY (id_vendedor) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 5) Função utilitária para triggers:
--    converte vendedor_id (agenda/rodízio) no profile_id correto para atendimentos_ia.id_vendedor
CREATE OR REPLACE FUNCTION public.resolve_profile_id_from_vendedor(p_vendedor_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_profile_id text;
BEGIN
  IF p_vendedor_id IS NULL OR btrim(p_vendedor_id) = '' THEN
    RETURN NULL;
  END IF;

  -- Se já for um profile/clerk id válido
  SELECT p.id
    INTO v_profile_id
  FROM public.profiles p
  WHERE p.id = p_vendedor_id
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    RETURN v_profile_id;
  END IF;

  -- Resolve via tabela vendedores
  SELECT p.id
    INTO v_profile_id
  FROM public.vendedores v
  JOIN public.profiles p
    ON p.id = COALESCE(v.clerk_id, v.id)
  WHERE v.id = p_vendedor_id
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    RETURN v_profile_id;
  END IF;

  -- Fallback por email + company_id (para vendedores legados sem clerk_id)
  SELECT p.id
    INTO v_profile_id
  FROM public.vendedores v
  JOIN public.profiles p
    ON p.company_id = v.company_id
   AND lower(trim(p.email)) = lower(trim(v.email))
  WHERE v.id = p_vendedor_id
  LIMIT 1;

  RETURN v_profile_id;
END;
$$;

-- 6) Recria a view vendedor_da_vez, se existia antes da migração
DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT definition
    INTO v_definition
  FROM _tmp_vendedor_da_vez_def
  LIMIT 1;

  IF v_definition IS NOT NULL THEN
    EXECUTE format('CREATE OR REPLACE VIEW public.vendedor_da_vez AS %s', v_definition);
  END IF;
END $$;

COMMIT;

-- Importante para as triggers de agendamento/rodízio:
-- usar `public.resolve_profile_id_from_vendedor(NEW.vendedor_id::text)` ao atualizar atendimentos_ia.id_vendedor
-- e remover casts forçados para uuid quando comparar/atribuir IDs de vendedor.
