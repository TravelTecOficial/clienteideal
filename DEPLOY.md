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

Já deployadas no projeto PROD. Para redeploy:

```bash
npx supabase functions deploy clerk-webhook --project-ref bctjodobbsxieywgulvl
npx supabase functions deploy clerk-invite-vendedor --project-ref bctjodobbsxieywgulvl
npx supabase functions deploy sync-profile-client --project-ref bctjodobbsxieywgulvl
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

- O chat chama o webhook n8n diretamente em produção
- n8n deve permitir CORS do domínio de produção
- Webhook configurado para "Respond: When Last Node Finishes"

Se houver bloqueio de CORS, será necessário um proxy serverless.

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

## 8. Checklist Final

- [ ] Variáveis de ambiente configuradas
- [ ] Migrações aplicadas no Supabase PROD (se necessário)
- [ ] Edge Functions deployadas
- [ ] Clerk: domínio e redirect URLs
- [ ] Supabase: Site URL e Redirect URLs
- [ ] n8n: CORS do domínio de produção
- [ ] Build local: `npm run build && npm run preview`
