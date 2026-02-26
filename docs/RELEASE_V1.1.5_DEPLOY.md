# Deploy v1.1.5 — Guia Rápido

**Data:** 2026-02-26

---

## Resumo da Análise de Branches

| Branch | Status |
|--------|--------|
| `main` | Branch atual de produção |
| `feature/tag-manager` | Mergeada na main |
| `fix/rodape-logotipo` | Mergeada na main |
| `plan`, `v1.1.0`, `versao-1.0.0` | Mergeadas ou atrás da main |
| `dev` | Antiga; main está à frente |

**Conclusão:** Não há branches com commits não mergeados na main. O deploy deve ser feito a partir da branch `main`.

---

## ⚠️ Atenção: Alterações Locais Pendentes

Existem alterações **não commitadas** que precisam ser commitadas antes do deploy:

- `package.json`, `package-lock.json`
- `src/App.tsx`, `ConfiguracoesPage.tsx`, `leads/index.tsx`, `prompt-atendimento/index.tsx`
- `src/lib/csv-leads-import.ts`, `LeadFormPage.tsx`, `LeadImportModal.tsx`
- `supabase/migrations/20260226120000_leads_status_cliente.sql` (modificada)
- `supabase/migrations/20260226160000_campanhas_anuncios.sql` (nova)
- `supabase/migrations/20260226170000_leads_utm_demografia.sql` (nova)
- `supabase/scripts/apply_campanhas_anuncios.sql` (novo)
- `docs/LEADS_API_PAYLOAD.md` (novo)

**Passo obrigatório antes do deploy:** Fazer commit e push dessas alterações para `main`.

---

## Ordem de Execução do Deploy

1. **Commit e push** de todas as alterações locais
2. **Migrações** no Supabase PROD: `npx supabase db push`
3. **Edge Functions** (se necessário): deploy de `admin-gtm-config` e `get-gtm-config`
4. **Build e deploy** na plataforma (Vercel/Netlify)

---

## Migrações que Serão Aplicadas

| Arquivo | Descrição |
|---------|-----------|
| `20260226120000_leads_status_cliente.sql` | Status "Cliente" + trigger |
| `20260226130000_leads_flag_cliente.sql` | Flag cliente |
| `20260226140000_ideal_customers_identifying_phrase.sql` | Frase identificação |
| `20260226150000_prompt_atendimento_multi_per_company.sql` | Prompt multi-empresa |
| `20260226160000_campanhas_anuncios.sql` | Tabela campanhas |
| `20260226170000_leads_utm_demografia.sql` | UTM e demografia em leads |

---

## Documentos Atualizados

- [CHANGELOG.md](../CHANGELOG.md) — Entrada v1.1.5
- [DEPLOY.md](../DEPLOY.md) — Migrações e checklist
- [DOCUMENTACAO_SISTEMA_V1.md](./DOCUMENTACAO_SISTEMA_V1.md) — Rotas e versão
- [LEADS_API_PAYLOAD.md](./LEADS_API_PAYLOAD.md) — Payload para integrações
