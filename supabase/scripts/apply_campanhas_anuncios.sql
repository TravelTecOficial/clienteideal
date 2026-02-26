-- Aplicar migration campanhas_anuncios manualmente
-- Execute no Supabase Dashboard > SQL Editor (projeto mrkvvgofjyvlutqpvedt)

-- Cadastro de campanhas de anúncios (para futura associação com Cliente Ideal)
CREATE TABLE IF NOT EXISTS public.campanhas_anuncios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  company_id text NOT NULL REFERENCES public.companies(id),
  nome text NOT NULL,
  campaign_id text NOT NULL,
  plataforma text NOT NULL,
  ideal_customer_id uuid REFERENCES public.ideal_customers(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.campanhas_anuncios IS 'Campanhas de anúncios por empresa. Futura associação com ideal_customers para análise de performance.';

-- RLS em campanhas_anuncios
ALTER TABLE public.campanhas_anuncios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company campanhas_anuncios" ON public.campanhas_anuncios;
CREATE POLICY "Users can view company campanhas_anuncios" ON public.campanhas_anuncios
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can insert company campanhas_anuncios" ON public.campanhas_anuncios;
CREATE POLICY "Users can insert company campanhas_anuncios" ON public.campanhas_anuncios
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can update company campanhas_anuncios" ON public.campanhas_anuncios;
CREATE POLICY "Users can update company campanhas_anuncios" ON public.campanhas_anuncios
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can delete company campanhas_anuncios" ON public.campanhas_anuncios;
CREATE POLICY "Users can delete company campanhas_anuncios" ON public.campanhas_anuncios
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );
