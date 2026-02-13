-- Configurações e Pagamentos de Anúncios
-- Adiciona campos de atendimento em companies e tabela pagamentos_anuncios

-- 1. Novos campos em companies (dados do atendimento)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS celular_atendimento text,
  ADD COLUMN IF NOT EXISTS email_atendimento text;

-- 2. Tabela pagamentos_anuncios
CREATE TABLE IF NOT EXISTS public.pagamentos_anuncios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  company_id text NOT NULL REFERENCES public.companies(id),
  data date NOT NULL,
  plataforma text NOT NULL CHECK (plataforma IN ('Google Ads', 'Meta Ads')),
  valor numeric NOT NULL DEFAULT 0
);

-- 3. RLS em pagamentos_anuncios
ALTER TABLE public.pagamentos_anuncios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company pagamentos_anuncios" ON public.pagamentos_anuncios
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can insert company pagamentos_anuncios" ON public.pagamentos_anuncios
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can update company pagamentos_anuncios" ON public.pagamentos_anuncios
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can delete company pagamentos_anuncios" ON public.pagamentos_anuncios
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );
