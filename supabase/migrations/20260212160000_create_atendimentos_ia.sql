-- Criar a tabela de atendimentos (conversas da IA)
-- Multitenancy via company_id (text, compatível com Clerk). id_vendedor nullable.
CREATE TABLE IF NOT EXISTS public.atendimentos_ia (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id TEXT NOT NULL,
    id_vendedor TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    id_conversa TEXT,
    score_final INTEGER DEFAULT 0,
    classificacao TEXT,
    nome TEXT,
    celular TEXT NOT NULL,
    email TEXT,
    idade DATE,
    preferencia TEXT,
    reuniao_date TIMESTAMP WITH TIME ZONE,
    lead_results TEXT,
    external_id TEXT,
    estagio TEXT,
    estado TEXT,
    cidade TEXT,
    utm_id TEXT,
    utm_campaing TEXT,
    utm_content TEXT,
    utm_medium TEXT,
    utm_source TEXT,
    gclid TEXT,
    fbclid TEXT,
    historico_json JSONB
);

-- Habilitar RLS
ALTER TABLE public.atendimentos_ia ENABLE ROW LEVEL SECURITY;

-- Política: apenas SELECT (read-only). Isolamento via profiles (compatível com Clerk)
CREATE POLICY "Empresas visualizam apenas seus próprios atendimentos"
ON public.atendimentos_ia
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
  )
);
