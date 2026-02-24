-- Adiciona id_grupo para armazenar o grupo de WhatsApp associado ao agendamento
ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS id_grupo text;

COMMENT ON COLUMN public.agenda.id_grupo IS 'ID do grupo WhatsApp (ex: 120363123456789012@g.us). Não exibido na UI.';
