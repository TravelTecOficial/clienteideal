-- Altera o default de enabled para false (switch off por padrão).
ALTER TABLE public.prompt_template_stages
  ALTER COLUMN enabled SET DEFAULT false;
