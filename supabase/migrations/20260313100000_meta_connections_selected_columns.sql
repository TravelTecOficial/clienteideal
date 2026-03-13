-- Colunas dedicadas para IDs de seleção em meta_connections (Instagram, Facebook, Meta Ads).
-- Facilita consultas e evita depender de metadata JSONB para IDs.

ALTER TABLE public.meta_connections
  ADD COLUMN IF NOT EXISTS selected_page_id text,
  ADD COLUMN IF NOT EXISTS selected_page_name text,
  ADD COLUMN IF NOT EXISTS selected_instagram_id text,
  ADD COLUMN IF NOT EXISTS selected_instagram_username text,
  ADD COLUMN IF NOT EXISTS selected_ad_account_id text,
  ADD COLUMN IF NOT EXISTS selected_ad_account_name text;

COMMENT ON COLUMN public.meta_connections.selected_page_id IS 'ID da página Facebook selecionada (apenas número).';
COMMENT ON COLUMN public.meta_connections.selected_instagram_id IS 'ID do Instagram Business selecionado (apenas número, para media_publish).';
COMMENT ON COLUMN public.meta_connections.selected_ad_account_id IS 'ID da conta Meta Ads selecionada.';

-- Migrar dados existentes de metadata para as novas colunas
UPDATE public.meta_connections
SET
  selected_page_id = COALESCE(
    (metadata->>'selected_page_id'),
    selected_page_id
  ),
  selected_page_name = COALESCE(
    (metadata->>'selected_page_name'),
    selected_page_name
  ),
  selected_instagram_id = COALESCE(
    (metadata->>'selected_instagram_id'),
    selected_instagram_id
  ),
  selected_instagram_username = COALESCE(
    (metadata->>'selected_instagram_username'),
    selected_instagram_username
  ),
  selected_ad_account_id = COALESCE(
    (metadata->>'selected_ad_account_id'),
    selected_ad_account_id
  ),
  selected_ad_account_name = COALESCE(
    (metadata->>'selected_ad_account_name'),
    selected_ad_account_name
  )
WHERE metadata IS NOT NULL
  AND (
    metadata ? 'selected_page_id'
    OR metadata ? 'selected_instagram_id'
    OR metadata ? 'selected_ad_account_id'
  );
