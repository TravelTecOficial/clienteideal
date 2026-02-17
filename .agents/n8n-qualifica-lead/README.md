# Subworkflow qualifica_lead - SDR Automatizado

## Visão geral

Este subworkflow é chamado pela tool `qualifica_lead` do AI Agent (Lúcia) no fluxo principal. Recebe `id` e `resposta`, retorna **uma pergunta por vez** ou a classificação final (Quente, Morno, Frio).

## Estrutura do subworkflow

```
                    ┌→ [Supabase Config] ─┐
[Input] → [Edit Fields]                    ├→ [Merge] → [Limit 1] → [Code] → [Supabase Upsert] → [Set Output]
                    └→ [Supabase Sessao] ──┘
```

(Edit Fields alimenta os dois Supabase em paralelo; Merge combina; Limit 1 garante que o Code rode uma vez.)

### 1. Input (Workflow Inputs)

O workflow recebe do AI Agent:
- `id` (string, obrigatório): remote_jid / número do WhatsApp
- `resposta` (string, opcional): vazio na primeira chamada
- `company_id` (string, obrigatório): para multitenancy

### 2. Edit Fields (nome do nó: `Edit Fields`)

Preparar e normalizar:
- `id` = `{{ $json.id }}`
- `resposta` = `{{ $json.resposta || '' }}`
- `company_id` = `{{ $json.company_id || 'SEU_COMPANY_ID' }}` (ajustar para sua empresa)

Conectar este nó aos dois Supabase (Config e Sessao) em paralelo.

### 3. Supabase Config (nome do nó: `Supabase Config`)

- **Operação**: Get many
- **Tabela**: `config_qualificacao`
- **Filtros**: `company_id` = `{{ $json.company_id }}`
- **Ordenação**: `ordem` ASC

### 4. Supabase Sessao (nome do nó: `Supabase Sessao`)

- **Operação**: Get
- **Tabela**: `leads_sessao`
- **Filtro**: `remote_jid` = `{{ $json.id }}`

(Se não existir, o Code trata como nova sessão.)

### 5. Merge

Combinar saídas de Supabase Config e Supabase Sessao. Modo: Combine by index.

### 6. Limit

Definir **1** item para garantir que o Code rode uma única vez (evita execução por cada pergunta).

### 7. Code (JavaScript)

Colar o conteúdo de `code-node-qualifica-lead.js`. O script referencia:
- `$('Supabase Config').all()` — perguntas
- `$('Supabase Sessao').first().json` — sessão atual

### 8. Supabase Upsert

- **Operação**: Upsert
- **Tabela**: `leads_sessao`
- **Conflict key**: `remote_jid`
- **Campos**: `remote_jid`, `company_id`, `current_step`, `score_total`, `status`, `updated_at` = now()

(Insert na primeira chamada, Update nas demais.)

### 9. Set Output

Extrair apenas o campo `output` para retorno à Lúcia:
- `output` = `{{ $json.output }}`

(O AI Agent espera um JSON string ou objeto com `proxima_pergunta` ou `status` + `classificacao`.)

---

## Importação manual (API 404)

Se o `n8n_create_workflow` retornar 404 (path da API diferente), importe manualmente:

1. No n8n: **Workflows → Import from File**
2. Selecione o arquivo `workflow-qualifica-lead-import.json`
3. Configure as credenciais Supabase nos nós **Supabase Config**, **Supabase Sessao** e **Supabase Upsert**
4. Ajuste o `company_id` padrão no nó **Edit Fields** se necessário
5. Salve e anote o ID do workflow para configurar a tool no fluxo principal

**Nota**: O Supabase Upsert usa `Create` — na primeira chamada insere; em chamadas seguintes pode falhar por duplicata. Se necessário, troque por um nó **Update** com filtro `remote_jid` e adicione lógica IF para Create vs Update.

---

## Reconfiguração da Tool no fluxo principal

No workflow **[SDR] - Sistema de Atendimento - Fluxo Principal**, editar o nó `qualifica_lead`:

1. **Workflow**: apontar para este subworkflow
2. **Schema de input** (remover parâmetros fixos):
   - `id` (string, obrigatório)
   - `resposta` (string, opcional)
   - `company_id` (string, obrigatório — ou definir valor fixo no subworkflow)
3. **Mapeamento**:
   - `id` = `{{ $json.id }}`
   - `resposta` = `{{ $fromAI('resposta', 'Resposta do usuário à pergunta atual', 'string') }}`
   - `company_id` = valor fixo da empresa ou de variável de ambiente

---

## Fonte das perguntas (módulo existente)

As perguntas vêm das tabelas **qualificadores**, **qualificacao_perguntas** e **qualificacao_respostas** — o mesmo módulo usado na página de Qualificação do frontend. A view `v_qualificacao_sdr` consolida essas tabelas no formato esperado pelo SDR.

Não é necessário popular `config_qualificacao` — use o frontend de Qualificação para cadastrar qualificadores, perguntas e respostas (fria, morna, quente).

---

## Popular config_qualificacao (INSERT) — apenas se não usar a view

Use o SQL abaixo ou adapte o JSON do frontend:

```sql
INSERT INTO config_qualificacao (company_id, pergunta_texto, peso, criterio_frio, criterio_morno, criterio_quente, ordem)
VALUES
  ('SEU_COMPANY_ID', 'Você deseja adquirir Imóvel ou Veículo?', 2, 'não sei', 'talvez', 'sim, imovel ou veiculo', 1),
  ('SEU_COMPANY_ID', 'Qual é o valor do crédito que você gostaria?', 2, 'não tenho', 'ainda não sei', 'já defini', 2),
  ('SEU_COMPANY_ID', 'Qual é a sua renda mensal?', 2, 'baixa', 'média', 'alta', 3),
  ('SEU_COMPANY_ID', 'Possui alguma restrição no nome?', 2, 'sim', 'não sei', 'não', 4),
  ('SEU_COMPANY_ID', 'Possui algum valor para o lance? Quanto?', 2, 'não', 'pouco', 'sim, tenho', 5),
  ('SEU_COMPANY_ID', 'Em quanto tempo você desejaria ter o crédito?', 1, 'muito tempo', 'alguns meses', 'urgente', 6),
  ('SEU_COMPANY_ID', 'Qual é o prazo que você deseja contratar o consórcio?', 1, 'longo', 'médio', 'curto', 7);
```

### Formato JSON para o frontend

Se o frontend enviar um array de perguntas:

```json
{
  "company_id": "company-xxx",
  "perguntas": [
    {
      "pergunta_texto": "Pergunta 1",
      "peso": 2,
      "criterio_frio": "não",
      "criterio_morno": "talvez",
      "criterio_quente": "sim",
      "ordem": 1
    }
  ]
}
```

Converter para INSERT:

```javascript
const { company_id, perguntas } = payload;
const values = perguntas.map((p, i) =>
  `('${company_id}', '${p.pergunta_texto.replace(/'/g, "''")}', ${p.peso || 1}, '${(p.criterio_frio || '').replace(/'/g, "''")}', '${(p.criterio_morno || '').replace(/'/g, "''")}', '${(p.criterio_quente || '').replace(/'/g, "''")}', ${i + 1})`
).join(',\n');
// INSERT INTO config_qualificacao (...) VALUES ${values}
```

---

## Régua de classificação (no código)

Ajustável em `code-node-qualifica-lead.js`:

```javascript
const REGUA = { quente: 70, morno: 35 };
// score_total >= 70: Quente
// score_total >= 35 e < 70: Morno
// score_total < 35: Frio
```

Com 7 perguntas de peso 2 e máximo 10 pts cada: máximo = 140. Ajuste conforme o número de perguntas.
