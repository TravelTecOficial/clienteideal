-- Adiciona coluna estancia_whatsapp em companies (dados do atendimento)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS estancia_whatsapp text;
