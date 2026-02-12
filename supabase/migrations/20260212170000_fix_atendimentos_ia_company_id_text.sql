-- Corrigir atendimentos_ia: company_id e id_vendedor devem ser TEXT (compatível com Clerk)
-- A tabela pode ter sido criada com UUID; o app usa Clerk IDs (strings)

DROP POLICY IF EXISTS "Empresas visualizam apenas seus próprios atendimentos" ON public.atendimentos_ia;

ALTER TABLE public.atendimentos_ia
  DROP CONSTRAINT IF EXISTS atendimentos_ia_id_vendedor_fkey;

ALTER TABLE public.atendimentos_ia
  ALTER COLUMN company_id TYPE TEXT USING company_id::text;

ALTER TABLE public.atendimentos_ia
  ALTER COLUMN id_vendedor TYPE TEXT USING id_vendedor::text;

ALTER TABLE public.atendimentos_ia
  ADD CONSTRAINT atendimentos_ia_id_vendedor_fkey
  FOREIGN KEY (id_vendedor) REFERENCES profiles(id) ON DELETE SET NULL;

CREATE POLICY "Empresas visualizam apenas seus próprios atendimentos"
ON public.atendimentos_ia
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
  )
);
