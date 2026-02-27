-- Coluna conversao: texto livre para anotar o que o cliente comprou (qualquer segmento)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS conversao text;
COMMENT ON COLUMN public.leads.conversao IS 'O que o cliente comprou ou serviço contratado (texto livre, qualquer segmento).';
