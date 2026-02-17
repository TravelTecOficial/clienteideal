-- Adiciona coluna n8n_chat_webhook_url em companies (webhook do Chat de Conhecimento)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS n8n_chat_webhook_url text;
