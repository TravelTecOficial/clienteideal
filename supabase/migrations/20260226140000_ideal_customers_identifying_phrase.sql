-- Frase de identificação para ideal_customers e persona_templates (v1.0.3)
-- Ex: "Quero sair do aluguel", "Quero comprar meu carro novo"

ALTER TABLE public.ideal_customers
  ADD COLUMN IF NOT EXISTS identifying_phrase text;

COMMENT ON COLUMN public.ideal_customers.identifying_phrase IS
  'Frase que identifica o perfil (ex: Quero sair do aluguel, quero comprar meu carro novo)';

ALTER TABLE public.persona_templates
  ADD COLUMN IF NOT EXISTS identifying_phrase text;

COMMENT ON COLUMN public.persona_templates.identifying_phrase IS
  'Frase que identifica o modelo (ex: Quero sair do aluguel, quero comprar meu carro novo)';
