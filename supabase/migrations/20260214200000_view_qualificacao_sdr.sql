-- View que consolida qualificacao_perguntas + qualificacao_respostas no formato esperado pelo SDR
-- Usa as tabelas existentes do módulo de qualificação (qualificadores, qualificacao_perguntas, qualificacao_respostas)
CREATE OR REPLACE VIEW public.v_qualificacao_sdr AS
SELECT
  q.company_id,
  q.id AS qualificador_id,
  qp.id AS pergunta_id,
  qp.pergunta AS pergunta_texto,
  COALESCE(qp.peso, 1) AS peso,
  qp.ordem,
  STRING_AGG(CASE WHEN qr.tipo = 'fria' THEN qr.resposta_texto END, ' | ' ORDER BY qr.resposta_texto) AS criterio_frio,
  STRING_AGG(CASE WHEN qr.tipo = 'morna' THEN qr.resposta_texto END, ' | ' ORDER BY qr.resposta_texto) AS criterio_morno,
  STRING_AGG(CASE WHEN qr.tipo = 'quente' THEN qr.resposta_texto END, ' | ' ORDER BY qr.resposta_texto) AS criterio_quente
FROM public.qualificadores q
JOIN public.qualificacao_perguntas qp ON qp.qualificador_id = q.id
LEFT JOIN public.qualificacao_respostas qr ON qr.pergunta_id = qp.id
GROUP BY q.id, q.company_id, qp.id, qp.pergunta, qp.peso, qp.ordem;
