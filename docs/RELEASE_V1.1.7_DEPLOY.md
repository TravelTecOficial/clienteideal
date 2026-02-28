# Deploy v1.1.7 — Guia de Publicação

**Data:** 2026-02-28

---

## Resumo

Esta versão introduz o **Layout Contextual do Cliente Ideal**, novo modelo de **webhooks por segmento**, e alterações no relacionamento **Qualificador → Prompt → Persona**.

---

## Ordem de Execução do Deploy

1. **Commit e push** de todas as alterações locais para `main`
2. **Migrações** no Supabase PROD: `npx supabase db push`
3. **Edge Functions** (se necessário): `persona-generate-avatar`, `persona-template-generate-avatar`
4. **Build e deploy** na plataforma (Vercel/Netlify)

---

## Migrações que Serão Aplicadas

| Arquivo | Descrição |
|---------|-----------|
| `20260228120000_qualificador_prompt_persona_relacionamento.sql` | Qualificador e Persona vinculam ao prompt_atendimento; ideal_customer_id removido de qualificadores |
| `20260228140000_admin_webhook_segment_3campos.sql` | Webhooks por segmento (produção, teste, enviar arquivos); config chat removida |
| `20260228140100_companies_segment_type.sql` | Coluna segment_type em companies |
| `20260228150000_prompt_atendimento_rls_saas_admin.sql` | RLS para admin preview em prompt_atendimento |

---

## Atenção: Breaking Changes

### Webhooks n8n

- A config `chat` foi **removida** de `admin_webhook_config`
- O **Chat de Conhecimento** passa a usar `webhook_producao` do segmento da empresa (`companies.segment_type`)
- Cada segmento (consórcio, produtos) tem 3 webhooks: **Produção**, **Teste**, **Enviar arquivos**
- **Ação necessária:** Configurar `companies.segment_type` para cada empresa e garantir que os webhooks por segmento estejam preenchidos no Admin

### Qualificador / Persona

- Qualificadores não usam mais `ideal_customer_id`; usam `prompt_atendimento_id`
- Personas (ideal_customers) têm `prompt_atendimento_id`
- A view `v_qualificacao_sdr` foi recriada com `prompt_atendimento_id` e `persona_id`

---

## Documentos Atualizados

| Documento | Alterações |
|-----------|------------|
| [CHANGELOG.md](../CHANGELOG.md) | Entrada v1.1.7 |
| [DEPLOY.md](../DEPLOY.md) | Migrações, Edge Functions, seção Chat/Webhook |
| [DOCUMENTACAO_SISTEMA_V1.md](./DOCUMENTACAO_SISTEMA_V1.md) | Rotas, módulos, modelo de dados |

---

## Checklist Pré-Deploy

- [ ] `npm run build` executa sem erros
- [ ] `npm run lint` executa sem erros
- [ ] Migrações aplicadas em PROD
- [ ] Edge Functions deployadas (persona-generate-avatar, persona-template-generate-avatar)
- [ ] Empresas com `segment_type` configurado
- [ ] Webhooks por segmento configurados no Admin
