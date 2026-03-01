-- Execute este script no Supabase Dashboard > SQL Editor
-- Corrige o 404: cria as tabelas gmb_health_checks e gmb_audit_items

-- gmb_health_checks: score e contagens por empresa
CREATE TABLE IF NOT EXISTS public.gmb_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(id),
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  fraco_count integer NOT NULL DEFAULT 0,
  razoavel_count integer NOT NULL DEFAULT 0,
  bom_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- gmb_audit_items: itens de auditoria por empresa
CREATE TABLE IF NOT EXISTS public.gmb_audit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(id),
  category text,
  item_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok', 'error')),
  action_label text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.gmb_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmb_audit_items ENABLE ROW LEVEL SECURITY;

-- Políticas (remove antes de recriar para idempotência)
DROP POLICY IF EXISTS "Users can view company gmb_health_checks" ON public.gmb_health_checks;
DROP POLICY IF EXISTS "Users can view company gmb_audit_items" ON public.gmb_audit_items;

CREATE POLICY "Users can view company gmb_health_checks" ON public.gmb_health_checks
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can view company gmb_audit_items" ON public.gmb_audit_items
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_gmb_health_checks_company_id ON public.gmb_health_checks(company_id);
CREATE INDEX IF NOT EXISTS idx_gmb_audit_items_company_id ON public.gmb_audit_items(company_id);
CREATE INDEX IF NOT EXISTS idx_gmb_audit_items_company_ordem ON public.gmb_audit_items(company_id, ordem);

-- Seed opcional
INSERT INTO public.gmb_health_checks (company_id, score, fraco_count, razoavel_count, bom_count)
SELECT id, 91, 2, 0, 22
FROM public.companies
LIMIT 1
ON CONFLICT (company_id) DO NOTHING;

INSERT INTO public.gmb_audit_items (company_id, category, item_name, status, action_label, ordem)
SELECT c.id, 'Avaliações', 'Avaliações Sem Resposta', 'error', 'Resolver', 1
FROM (SELECT id FROM public.companies LIMIT 1) c;

INSERT INTO public.gmb_audit_items (company_id, category, item_name, status, action_label, ordem)
SELECT c.id, 'Informações', 'Data de Fundação', 'ok', 'OK', 2
FROM (SELECT id FROM public.companies LIMIT 1) c;
