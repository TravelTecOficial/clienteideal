-- Persistência da conta/propriedade GA4 selecionada por empresa
ALTER TABLE public.google_connections
  ADD COLUMN IF NOT EXISTS selected_account_name text,
  ADD COLUMN IF NOT EXISTS selected_account_display_name text,
  ADD COLUMN IF NOT EXISTS selected_property_name text,
  ADD COLUMN IF NOT EXISTS selected_property_display_name text;

COMMENT ON COLUMN public.google_connections.selected_account_name IS
  'Resource name da conta Google Analytics selecionada (ex: accountSummaries/123).';

COMMENT ON COLUMN public.google_connections.selected_account_display_name IS
  'Nome amigável da conta Google Analytics selecionada.';

COMMENT ON COLUMN public.google_connections.selected_property_name IS
  'Resource name da propriedade GA4 selecionada (ex: properties/123456789).';

COMMENT ON COLUMN public.google_connections.selected_property_display_name IS
  'Nome amigável da propriedade GA4 selecionada.';
