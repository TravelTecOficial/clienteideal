-- Coluna para imagem usada em grupos WhatsApp (pequena)
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS whatsapp_group_image_url text;

COMMENT ON COLUMN public.companies.whatsapp_group_image_url IS 'URL da imagem para uso em grupos WhatsApp (ex: logo pequena)';
