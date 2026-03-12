-- external_account_id, external_phone_id, display_phone_number são usados pelo WhatsApp.
-- Instagram, Facebook e Meta Ads não possuem esses campos; devem aceitar NULL.

ALTER TABLE public.meta_connections
  ALTER COLUMN external_account_id DROP NOT NULL,
  ALTER COLUMN external_phone_id DROP NOT NULL,
  ALTER COLUMN display_phone_number DROP NOT NULL;
