# Payload de Leads — Integrações (N8N, Formulários, Webhooks)

Este documento descreve os campos aceitos ao criar ou atualizar leads via API Supabase, para integrações com N8N, formulários de landing page ou outros webhooks.

## Campos obrigatórios (mínimo)

| Campo | Tipo | Descrição |
|-------|------|------------|
| `company_id` | text | ID da empresa (obrigatório) |
| `user_id` | text | ID do usuário Clerk (pode ser null se cadastro mínimo) |
| `name` | text | Nome do lead (pode ser null se cadastro mínimo) |

Regra de negócio: `company_id` + `external_id` + `phone` já caracterizam lead válido em cadastro mínimo.

## Campos opcionais — UTM e rastreamento

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `utm_id` | text | ID da campanha UTM |
| `utm_source` | text | Origem (ex: google, facebook) |
| `utm_medium` | text | Meio (ex: cpc, email) |
| `utm_campaign` | text | Nome da campanha |
| `utm_term` | text | Termo de busca |
| `utm_content` | text | Conteúdo/variante do anúncio |
| `gclid` | text | Google Click ID |
| `fbclid` | text | Facebook Click ID |

## Campos opcionais — Demografia e localização

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `data_nascimento` | date | Data de nascimento (YYYY-MM-DD) |
| `idade` | integer | Idade (0–150) |
| `cep` | text | CEP (12345-678 ou 12345678) |
| `ip` | text | Endereço IP de origem |

**Nota sobre IP:** Tratar como dado sensível. Considerar política de retenção (LGPD/GDPR).

## Campos opcionais — Produto e contato

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `item_id` | uuid | ID do produto ou serviço (tabela `items`) |
| `email` | text | Email |
| `phone` | text | Telefone |
| `external_id` | text | ID externo (CRM, etc.) |

## Campos de status

| Campo | Tipo | Valores | Descrição |
|-------|------|---------|-----------|
| `status` | text | Novo, Em Contato, Qualificado, Perdido | Status do lead |
| `classificacao` | text | Frio, Morno, Quente | Temperatura do lead |
| `seller_id` | text | uuid do vendedor | Vendedor atribuído |

## Exemplo de payload (N8N / Supabase Insert)

```json
{
  "company_id": "company-xxx",
  "user_id": "user_xxx",
  "name": "João Silva",
  "email": "joao@exemplo.com",
  "phone": "11999999999",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "campanha_verao",
  "gclid": "CjwKCAjw...",
  "data_nascimento": "1990-05-15",
  "idade": 34,
  "cep": "01310-100",
  "item_id": "uuid-do-produto",
  "status": "Novo",
  "classificacao": "Quente"
}
```

## Formulários de landing page

Ao capturar leads em formulários, inclua os parâmetros UTM na URL:

```
https://seusite.com/landing?utm_source=google&utm_medium=cpc&utm_campaign=verao&utm_content=banner1&gclid=xxx
```

No JavaScript do formulário, leia `URLSearchParams` e envie no payload:

```javascript
const params = new URLSearchParams(window.location.search);
const payload = {
  company_id: "...",
  name: formData.name,
  email: formData.email,
  utm_source: params.get("utm_source") || null,
  utm_medium: params.get("utm_medium") || null,
  utm_campaign: params.get("utm_campaign") || null,
  utm_content: params.get("utm_content") || null,
  utm_term: params.get("utm_term") || null,
  gclid: params.get("gclid") || null,
  fbclid: params.get("fbclid") || null,
};
```

## N8N — Supabase node

No nó **Supabase** do N8N, ao inserir em `leads`:

1. Mapeie os campos do payload de entrada para as colunas da tabela.
2. Garanta que `company_id` seja obtido do contexto (ex.: variável de ambiente ou mapeamento do webhook).
3. Os campos UTM e de clique podem vir de `$json` ou de headers/query params.

## Referências

- [DOCUMENTACAO_SISTEMA_V1.md](./DOCUMENTACAO_SISTEMA_V1.md) — Modelo de dados e módulos
- Migração: `supabase/migrations/20260226170000_leads_utm_demografia.sql`
