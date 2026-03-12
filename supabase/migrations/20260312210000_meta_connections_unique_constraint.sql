-- Garante constraint UNIQUE(company_id, provider_type) para upsert em meta_connections.
-- Corrige erro [42P10] "there is no unique or exclusion constraint matching the ON CONFLICT specification".

DO $$
BEGIN
  ALTER TABLE public.meta_connections
  ADD CONSTRAINT meta_connections_company_id_provider_type_key UNIQUE (company_id, provider_type);
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- constraint já existe
END $$;
