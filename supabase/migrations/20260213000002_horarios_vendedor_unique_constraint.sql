-- Constraint UNIQUE em (vendedor_email, dia_semana) para permitir ON CONFLICT no upsert
-- Necessário para o cadastro de vendedores (Módulo Vendedor)

ALTER TABLE public.horarios_vendedor
ADD CONSTRAINT horarios_vendedor_vendedor_email_dia_semana_key
UNIQUE (vendedor_email, dia_semana);
