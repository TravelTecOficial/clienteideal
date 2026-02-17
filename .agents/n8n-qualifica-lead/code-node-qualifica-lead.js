/**
 * N8N Code Node - qualifica_lead
 * Motor de qualificação SDR: recebe resposta do usuário, retorna próxima pergunta ou classificação final.
 *
 * INPUT (do workflow / nós anteriores):
 *   - id: remote_jid (número ou 5511999999999@s.whatsapp.net)
 *   - resposta: string (vazio na primeira chamada)
 *   - company_id: string (obrigatório para multitenancy)
 *
 * Dados dos nós anteriores (nome do nó obrigatório):
 *   - Edit Fields: id, resposta, company_id
 *   - Supabase Config: perguntas (config_qualificacao)
 *   - Supabase Sessao: sessão atual ou vazio
 *
 * OUTPUT: item com { output, remote_jid, current_step, score_total, status }
 *   - output: JSON para a Lúcia (proxima_pergunta OU status+classificacao)
 *   - demais campos: para o nó Supabase Upsert (incluir company_id)
 */

// --- Constantes (ajustáveis) ---
const PONTOS = { quente: 10, morno: 5, frio: 1 };
const REGUA_FALLBACK = { limite_frio_max: 35, limite_morno_max: 70 }; // fallback para qualificadores antigos

// --- Helpers ---
function normalizarJid(id) {
  if (!id) return '';
  const s = String(id).trim();
  return s.includes('@') ? s.split('@')[0] : s;
}

function classificarResposta(resposta, criterioQuente, criterioMorno, criterioFrio) {
  const r = (resposta || '').toLowerCase().trim();
  if (!r) return 'morno'; // fallback conservador

  const opts = (str) =>
    (str || '')
      .split(/\s*\|\s*/)
      .map((s) => s.toLowerCase().trim())
      .filter(Boolean);

  const matchOpts = (arr) => arr.some((o) => r.includes(o) || o.includes(r));

  // Prioridade: Quente > Morno > Frio (primeiro match)
  const qOpts = opts(criterioQuente);
  const mOpts = opts(criterioMorno);
  const fOpts = opts(criterioFrio);
  if (qOpts.length && matchOpts(qOpts)) return 'quente';
  if (mOpts.length && matchOpts(mOpts)) return 'morno';
  if (fOpts.length && matchOpts(fOpts)) return 'frio';

  return 'morno'; // fallback
}

function classificarScore(scoreTotal, limiteFrioMax, limiteMornoMax) {
  const frio = limiteFrioMax != null ? limiteFrioMax : REGUA_FALLBACK.limite_frio_max;
  const morno = limiteMornoMax != null ? limiteMornoMax : REGUA_FALLBACK.limite_morno_max;
  if (scoreTotal >= morno) return 'Quente';
  if (scoreTotal >= frio) return 'Morno';
  return 'Frio';
}

// --- Main ---
const item = ($('Edit Fields').first() || $input.first()).json;
const id = normalizarJid(item.id || item.remote_jid);
const resposta = (item.resposta || '').trim();
const companyId = item.company_id || '';

if (!id || !companyId) {
  return [{ json: { output: JSON.stringify({ erro: 'id e company_id são obrigatórios' }), remote_jid: id, company_id: companyId } }];
}

// Obter perguntas e sessão dos nós anteriores
const perguntas = ($('Supabase Config').all() || []).map((i) => i.json).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
const sessaoItem = $('Supabase Sessao').first();
const sessao = sessaoItem ? sessaoItem.json : null;

// Limites dinâmicos do qualificador (vêm da view v_qualificacao_sdr)
const primeiraPergunta = perguntas[0];
const limiteFrioMax = primeiraPergunta?.limite_frio_max;
const limiteMornoMax = primeiraPergunta?.limite_morno_max;

let currentStep = sessao ? (sessao.current_step || 0) : 0;
let scoreTotal = sessao ? (sessao.score_total || 0) : 0;
let status = sessao ? (sessao.status || 'em_andamento') : 'em_andamento';

// Primeira chamada (sem resposta) -> retornar primeira pergunta
if (!resposta) {
  currentStep = 0;
  scoreTotal = 0;
  status = 'em_andamento';

  if (perguntas.length === 0) {
    return [
      {
        json: {
          output: JSON.stringify({
            status: 'concluido',
            classificacao: 'Frio',
            score_total: 0,
            mensagem: 'Nenhuma pergunta configurada.',
          }),
          remote_jid: id,
          company_id: companyId,
          current_step: 0,
          score_total: 0,
          status: 'concluido',
        },
      },
    ];
  }

  const primeira = perguntas[0];
  return [
    {
      json: {
        output: JSON.stringify({
          proxima_pergunta: primeira.pergunta_texto,
          status: 'em_andamento',
        }),
        remote_jid: id,
        company_id: companyId,
        current_step: 0,
        score_total: 0,
        status: 'em_andamento',
      },
    },
  ];
}

// Processar resposta: classificar, somar pontos, avançar step
const perguntaAtual = perguntas[currentStep];
if (!perguntaAtual) {
  return [
    {
      json: {
        output: JSON.stringify({
          status: 'concluido',
          classificacao: classificarScore(scoreTotal, limiteFrioMax, limiteMornoMax),
          score_total: scoreTotal,
        }),
        remote_jid: id,
        company_id: companyId,
        current_step: currentStep,
        score_total: scoreTotal,
        status: 'concluido',
      },
    },
  ];
}

const tipo = classificarResposta(
  resposta,
  perguntaAtual.criterio_quente,
  perguntaAtual.criterio_morno,
  perguntaAtual.criterio_frio
);
const peso = Math.min(3, Math.max(1, perguntaAtual.peso || 1));
const pontos = (PONTOS[tipo] || PONTOS.morno) * peso;

scoreTotal += pontos;
currentStep += 1;

// Existe próxima pergunta?
const proxima = perguntas[currentStep];
if (proxima) {
  return [
    {
      json: {
        output: JSON.stringify({
          proxima_pergunta: proxima.pergunta_texto,
          status: 'em_andamento',
        }),
        remote_jid: id,
        company_id: companyId,
        current_step: currentStep,
        score_total: scoreTotal,
        status: 'em_andamento',
      },
    },
  ];
}

// Fim: aplicar régua e retornar classificação final
status = 'concluido';
const classificacao = classificarScore(scoreTotal, limiteFrioMax, limiteMornoMax);

return [
  {
    json: {
      output: JSON.stringify({
        status: 'concluido',
        classificacao,
        score_total: scoreTotal,
      }),
      remote_jid: id,
      company_id: companyId,
      current_step: currentStep,
      score_total: scoreTotal,
      status,
    },
  },
];
