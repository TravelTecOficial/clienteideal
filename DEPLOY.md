# Guia de Deploy para Produção - Cliente Ideal

## Contexto

- **Stack**: React 19 + Vite 5 + Supabase + Clerk
- **Supabase PROD**: `bctjodobbsxieywgulvl` (us-east-1)
- **Supabase DEV**: `mrkvvgofjyvlutqpvedt` (sa-east-1)

---

## 1. Variáveis de Ambiente

Configure no painel da plataforma (Vercel/Netlify) ou em `.env.production`:

| Variável | Obrigatória | Valor |
|----------|-------------|-------|
| `VITE_SUPABASE_URL` | Sim | `https://bctjodobbsxieywgulvl.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Sim | Chave anon do projeto Supabase PROD |
| `VITE_CLERK_PUBLISHABLE_KEY` | Sim | Chave `pk_live_...` do Clerk (produção) |
| `VITE_N8N_CHAT_WEBHOOK_URL` | Não | `https://jobs.traveltec.com.br/webhook/consulta-chat` (default) |

**Importante**: Nunca commite `.env.production` com chaves reais.

---

## 2. Migrações do Banco (Supabase)

Se houver divergência entre migrações locais e remotas:

```bash
# Vincular ao projeto de produção
npx supabase link --project-ref bctjodobbsxieywgulvl

# Verificar status
npx supabase db diff

# Aplicar migrações pendentes
npx supabase db push
```

**Se aparecer erro de versões remotas não encontradas localmente**, o banco pode ter migrações com timestamps diferentes. Opções:

- `npx supabase db pull` — puxa o schema remoto e gera migração local
- `npx supabase migration repair --status reverted <versões>` — apenas se souber o que está fazendo

---

## 3. Edge Functions (Supabase)

Já deployadas no projeto PROD. Para redeploy completo:

```bash
PROJECT_REF=bctjodobbsxieywgulvl

npx supabase functions deploy clerk-webhook --project-ref $PROJECT_REF
npx supabase functions deploy sync-profile-client --project-ref $PROJECT_REF
npx supabase functions deploy clerk-invite-vendedor --project-ref $PROJECT_REF
npx supabase functions deploy admin-list-users --project-ref $PROJECT_REF
npx supabase functions deploy admin-list-companies --project-ref $PROJECT_REF
npx supabase functions deploy admin-update-company --project-ref $PROJECT_REF
npx supabase functions deploy admin-webhook-config --project-ref $PROJECT_REF
npx supabase functions deploy admin-evolution-config --project-ref $PROJECT_REF
npx supabase functions deploy evolution-proxy --project-ref $PROJECT_REF
npx supabase functions deploy evolution-webhook --project-ref $PROJECT_REF
npx supabase functions deploy chat-conhecimento-proxy --project-ref $PROJECT_REF
npx supabase functions deploy upload-kb-to-webhook --project-ref $PROJECT_REF
npx supabase functions deploy admin-gtm-config --project-ref $PROJECT_REF
npx supabase functions deploy get-gtm-config --project-ref $PROJECT_REF
```

---

## 4. Configurações Clerk (Produção)

1. [clerk.com](https://clerk.com) → seu app → **Configure**
2. **JWT Templates**: template "supabase" configurado
3. **Allowed redirect URLs**: `https://seu-dominio.com/*`
4. **Domains**: domínio de produção

---

## 5. Configurações Supabase (Produção)

1. **Auth → URL Configuration**:
   - Site URL: `https://seu-dominio.com`
   - Redirect URLs: `https://seu-dominio.com/*`

2. **Integração Clerk**: issuer do Clerk configurado no JWT template

---

## 6. Chat e Webhook n8n

- O **Chat de Conhecimento** usa a Edge Function `chat-conhecimento-proxy` (não chama n8n diretamente)
- O proxy envia o payload ao webhook configurado em **Admin → Configurações → Chat de Conhecimento**
- n8n deve permitir requisições do domínio do Supabase (Edge Functions)
- Webhook configurado para "Respond: When Last Node Finishes"

**Se o webhook não aparecer após configurar no Admin**, verifique:

1. **Migração aplicada em PROD**: a tabela `admin_webhook_config` deve ter `config_type='chat'` e coluna `webhook_chat`. Execute `scripts/verificar_webhook_chat_prod.sql` no SQL Editor do Supabase.

2. **Fallback via secret** (se o Admin não salvar corretamente):
   ```bash
   npx supabase secrets set N8N_CHAT_WEBHOOK_URL=https://seu-n8n.com/webhook/sua-url --project-ref bctjodobbsxieywgulvl
   ```
   O proxy usa esse valor quando `admin_webhook_config.webhook_chat` está vazio.

---

## 7. Deploy na Plataforma

### Vercel

1. Conecte o repositório em [vercel.com](https://vercel.com)
2. Framework Preset: **Vite**
3. Build: `npm run build` | Output: `dist`
4. Configure as variáveis de ambiente
5. Adicione o domínio customizado

### Netlify

1. Conecte o repositório em [netlify.com](https://netlify.com)
2. O arquivo `netlify.toml` já define build e SPA fallback
3. Build: `npm run build` | Publish: `dist`
4. Configure as variáveis de ambiente

### Outro hosting estático

- `npm run build` → upload da pasta `dist`
- Configure SPA fallback: todas as rotas servem `index.html`

---

## 8. Migrações Pendentes (Deploy 2026-02-26)

Se este é o primeiro deploy após as alterações de v1.1.5, as seguintes migrações serão aplicadas automaticamente pelo `db push` (ordem por timestamp):

| Migração | Descrição |
|----------|-----------|
| `20260226120000_leads_status_cliente.sql` | Status "Cliente" + trigger em opportunities |
| `20260226130000_leads_flag_cliente.sql` | Flag cliente em leads |
| `20260226140000_ideal_customers_identifying_phrase.sql` | Frase de identificação no Cliente Ideal |
| `20260226150000_prompt_atendimento_multi_per_company.sql` | Prompt multi-empresa |
| `20260226160000_campanhas_anuncios.sql` | Tabela campanhas_anuncios |
| `20260226170000_leads_utm_demografia.sql` | UTM, demografia, item_id em leads |

**Script opcional** (se precisar aplicar campanhas manualmente): `supabase/scripts/apply_campanhas_anuncios.sql`

---

## 9. Checklist Final

- [ ] **Pré-deploy**: Commit e push de todas as alterações locais para `main`
- [ ] Variáveis de ambiente configuradas
- [ ] Migrações aplicadas no Supabase PROD (`npx supabase db push`)
- [ ] Edge Functions deployadas (se houver alterações)
- [ ] Clerk: domínio e redirect URLs
- [ ] Supabase: Site URL e Redirect URLs
- [ ] n8n: CORS do domínio de produção
- [ ] Build local: `npm run build && npm run preview`
