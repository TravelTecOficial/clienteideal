-- Criar a tabela de atendimentos (conversas da IA)
CREATE TABLE public.atendimentos_ia (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL, -- Obrigatório para Multitenancy
    id_vendedor UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Permite NULL conforme solicitado
    id_conversa TEXT,
    score_final INTEGER DEFAULT 0,
    classificacao TEXT, -- Quente, Morno, Frio
    nome TEXT,
    celular TEXT NOT NULL,
    email TEXT,
    idade DATE,
    preferencia TEXT,
    reuniao_date TIMESTAMP WITH TIME ZONE,
    lead_results TEXT, -- Venceu ou Perdeu
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
    historico_json JSONB -- Campo para armazenar o log da conversa da IA
);

-- Habilitar RLS
ALTER TABLE public.atendimentos_ia ENABLE ROW LEVEL SECURITY;

-- Política de Segurança: Apenas dados da própria empresa (Baseado no JWT do Clerk/Supabase)
CREATE POLICY "Empresas visualizam apenas seus próprios atendimentos" 
ON public.atendimentos_ia
FOR SELECT
USING (company_id = ((auth.jwt() -> 'user_metadata'::text) ->> 'company_id'::text)::uuid);