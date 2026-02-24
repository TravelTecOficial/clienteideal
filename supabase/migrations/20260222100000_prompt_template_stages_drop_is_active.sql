-- Remove is_active de prompt_template_stages se existir.
-- Apenas enabled é usado (switch de habilitar/desabilitar estágio).
-- is_active era redundante (sempre true) e não é referenciado no código.

ALTER TABLE public.prompt_template_stages
  DROP COLUMN IF EXISTS is_active;
