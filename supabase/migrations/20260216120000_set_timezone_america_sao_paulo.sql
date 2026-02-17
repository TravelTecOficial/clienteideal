-- Configura timezone padrão do banco para America/Sao_Paulo
-- Corrige diferença de 3 horas nos agendamentos
ALTER DATABASE postgres SET timezone TO 'America/Sao_Paulo';
