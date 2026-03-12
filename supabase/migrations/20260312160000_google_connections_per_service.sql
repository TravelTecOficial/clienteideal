-- Conexões Google por serviço: ga4, ads, mybusiness independentes
-- Migra dados existentes (1 linha = 3 scopes) para 3 linhas (uma por serviço)

-- 1. Adicionar coluna service com default para linhas existentes
ALTER TABLE public.google_connections ADD COLUMN IF NOT EXISTS service text DEFAULT 'ga4';

-- 2. Remover constraint UNIQUE(company_id) para permitir múltiplas linhas por empresa
ALTER TABLE public.google_connections DROP CONSTRAINT IF EXISTS google_connections_company_id_key;

-- 3. Replicar linhas existentes para ads e mybusiness (mesmos tokens, mesmos scopes)
INSERT INTO public.google_connections (
  company_id, access_token_encrypted, refresh_token_encrypted,
  token_expires_at, scopes, status, connected_at, created_at, updated_at, service
)
SELECT company_id, access_token_encrypted, refresh_token_encrypted,
  token_expires_at, scopes, status, connected_at, created_at, now(), 'ads'
FROM public.google_connections
WHERE service = 'ga4';

INSERT INTO public.google_connections (
  company_id, access_token_encrypted, refresh_token_encrypted,
  token_expires_at, scopes, status, connected_at, created_at, updated_at, service
)
SELECT company_id, access_token_encrypted, refresh_token_encrypted,
  token_expires_at, scopes, status, connected_at, created_at, now(), 'mybusiness'
FROM public.google_connections
WHERE service = 'ga4';

-- 4. Garantir service NOT NULL
ALTER TABLE public.google_connections ALTER COLUMN service SET NOT NULL;

-- 5. Adicionar UNIQUE(company_id, service)
ALTER TABLE public.google_connections ADD CONSTRAINT google_connections_company_id_service_key UNIQUE (company_id, service);

-- 6. Índice para buscas por (company_id, service)
CREATE INDEX IF NOT EXISTS idx_google_connections_company_service
  ON public.google_connections(company_id, service);

COMMENT ON COLUMN public.google_connections.service IS 'Serviço: ga4, ads ou mybusiness';
