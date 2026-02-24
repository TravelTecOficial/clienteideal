-- Adiciona categoria_objetivo em prompt_templates (para filtrar templates por modelo de atendimento)
-- Adiciona fluxo_objetivo e campos de Follow-up em prompt_atendimento

ALTER TABLE public.prompt_templates
  ADD COLUMN IF NOT EXISTS categoria_objetivo text;

COMMENT ON COLUMN public.prompt_templates.categoria_objetivo IS 'Modelo de atendimento: atendimento, atendimento_agendamento, atendimento_qualificacao_agendamento, atendimento_completo, atendimento_agendamento_pagamento';

ALTER TABLE public.prompt_atendimento
  ADD COLUMN IF NOT EXISTS fluxo_objetivo text,
  ADD COLUMN IF NOT EXISTS follow_up_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_tempo integer,
  ADD COLUMN IF NOT EXISTS follow_up_tentativas integer;

COMMENT ON COLUMN public.prompt_atendimento.fluxo_objetivo IS 'Objetivo do negócio selecionado (mesmos valores de categoria_objetivo)';
COMMENT ON COLUMN public.prompt_atendimento.follow_up_active IS 'Se o follow-up está ativo';
COMMENT ON COLUMN public.prompt_atendimento.follow_up_tempo IS 'Tempo de espera antes do contato (horas)';
COMMENT ON COLUMN public.prompt_atendimento.follow_up_tentativas IS 'Número de tentativas de retomada';
