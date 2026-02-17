-- Adicionar FK de opportunities.seller_id para vendedores.id
-- Permite JOIN/embed no Supabase para exibir nome do vendedor

-- 1. Anular seller_ids que não existem em vendedores (evita violação de FK)
UPDATE public.opportunities o
SET seller_id = NULL
WHERE o.seller_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.vendedores v
    WHERE v.id::text = trim(o.seller_id)
  );

-- 2. Converter seller_id de text para uuid
ALTER TABLE public.opportunities
  ALTER COLUMN seller_id TYPE uuid USING seller_id::uuid;

-- 3. Adicionar FK para vendedores
ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES public.vendedores(id) ON DELETE SET NULL;
