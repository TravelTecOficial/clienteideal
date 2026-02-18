-- Segmentação dos modelos de persona por tipo de negócio
ALTER TABLE public.persona_templates
ADD COLUMN IF NOT EXISTS segment_type text NOT NULL DEFAULT 'geral';

ALTER TABLE public.persona_templates
DROP CONSTRAINT IF EXISTS persona_templates_segment_type_check;

ALTER TABLE public.persona_templates
ADD CONSTRAINT persona_templates_segment_type_check
CHECK (segment_type IN ('geral', 'produtos', 'consorcio', 'seguros'));

COMMENT ON COLUMN public.persona_templates.segment_type IS
'Segmento do modelo de persona: geral, produtos, consorcio, seguros.';
