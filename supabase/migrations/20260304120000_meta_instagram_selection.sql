-- Seleção única de conta Meta/Instagram por empresa.
-- Estende meta_instagram_integrations com campos selected_*.

ALTER TABLE public.meta_instagram_integrations
  ADD COLUMN IF NOT EXISTS selected_page_id text,
  ADD COLUMN IF NOT EXISTS selected_page_name text,
  ADD COLUMN IF NOT EXISTS selected_instagram_id text,
  ADD COLUMN IF NOT EXISTS selected_instagram_username text,
  ADD COLUMN IF NOT EXISTS selected_ad_account_id text;

COMMENT ON COLUMN public.meta_instagram_integrations.selected_page_id IS 'ID da página Facebook selecionada para a empresa.';
COMMENT ON COLUMN public.meta_instagram_integrations.selected_page_name IS 'Nome da página Facebook selecionada para exibição na UI.';
COMMENT ON COLUMN public.meta_instagram_integrations.selected_instagram_id IS 'ID do Instagram Business selecionado para insights.';
COMMENT ON COLUMN public.meta_instagram_integrations.selected_instagram_username IS 'Username (@) do Instagram Business selecionado.';
COMMENT ON COLUMN public.meta_instagram_integrations.selected_ad_account_id IS 'ID da conta de anúncios Meta selecionada (futuro).';

