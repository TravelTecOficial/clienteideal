-- Atualiza o comentário da coluna tools para refletir o novo formato de parâmetros.
COMMENT ON COLUMN public.prompt_template_stages.tools IS
  'Array de { name, description, parameters: Array<{ name, info }> }. Cada parâmetro tem nome e informação (descrição do que deve receber).';
