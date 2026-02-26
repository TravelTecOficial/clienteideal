-- UTM e rastreamento
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_id text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_term text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_content text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS fbclid text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS gclid text;

-- Demografia
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS data_nascimento date;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS idade integer;

-- Produto/serviço (opcional)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.items(id) ON DELETE SET NULL;

-- Localização e identificação
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ip text;

COMMENT ON COLUMN public.leads.item_id IS 'Produto ou serviço de interesse (opcional). Referência à tabela items.';
COMMENT ON COLUMN public.leads.ip IS 'IP de origem. Considerar política de retenção (LGPD/GDPR).';
