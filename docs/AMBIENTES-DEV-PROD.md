# Configurar Ambientes: Desenvolvimento e Produção

Guia para ter dois ambientes separados e não precisar trocar chaves a cada deploy.

## Visão geral

| Ambiente | Supabase | Clerk | Arquivo de env |
|----------|----------|-------|----------------|
| **Desenvolvimento** (localhost) | Projeto dev | `pk_test_` + `sk_test_` | `.env.local` |
| **Produção** (domínio) | Projeto prod | `pk_live_` + `sk_live_` | `.env.production` ou variáveis do deploy |

---

## Passo 1: Criar projeto Supabase para desenvolvimento

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Clique em **New Project**
3. Nome: `clienteideal-dev` (ou similar)
4. Defina senha do banco e região
5. Aguarde a criação

---

## Passo 2: Aplicar migrations no projeto dev

As migrations em `supabase/migrations/` precisam estar no banco de dev:

```bash
# Vincule ao projeto dev (use o REF do projeto, ex: xyzabc123)
supabase link --project-ref SEU_PROJECT_REF_DEV

# Aplique as migrations
supabase db push

# Desvincule para não afetar o prod (opcional)
supabase unlink
```

Ou aplique manualmente pelo **SQL Editor** no Supabase Dashboard do projeto dev (copiando o conteúdo das migrations).

---

## Passo 3: Configurar secrets no projeto dev

1. No projeto **dev**: [Edge Functions > Secrets](https://supabase.com/dashboard/project/_/settings/functions)
2. Adicione:
   - `CLERK_SECRET_KEY` = `sk_test_...` (Secret Key de desenvolvimento do Clerk)
   - `CLERK_WEBHOOK_SECRET` = `whsec_...` (se usar webhook no dev)

---

## Passo 4: Deploy das Edge Functions no projeto dev

```bash
supabase link --project-ref SEU_PROJECT_REF_DEV
supabase functions deploy sync-profile-client
supabase functions deploy clerk-webhook
# ... outras functions
supabase unlink
```

---

## Passo 5: Arquivos de ambiente

### `.env.local` (desenvolvimento – não commitar)

Usado em `npm run dev`. Já deve existir:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO_DEV.supabase.co
VITE_SUPABASE_ANON_KEY=chave_anon_do_projeto_dev
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### `.env.production` (produção – pode commitar se só tiver URLs públicas)

Usado em `npm run build`. Crie se ainda não existir:

```env
VITE_SUPABASE_URL=https://bctjodobbsxieywgulvl.supabase.co
VITE_SUPABASE_ANON_KEY=chave_anon_do_projeto_prod
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
```

> O Vite usa automaticamente `.env.production` ao fazer `npm run build`. Em plataformas como Vercel/Netlify, as variáveis de produção são configuradas no painel do provedor.

---

## Passo 6: Webhook do Clerk (opcional)

Se usar webhook para `user.created`:

- **Dev**: crie um webhook no Clerk apontando para a URL da Edge Function do projeto dev.
- **Prod**: mantenha o webhook apontando para o projeto prod.

Ou use apenas um webhook (prod) e o `sync-profile-client` como fallback no dev.

---

## Resumo do fluxo

```
Desenvolvimento (npm run dev):
  .env.local → Projeto Supabase DEV → CLERK_SECRET_KEY=sk_test_

Produção (npm run build + deploy):
  .env.production ou variáveis do Vercel/Netlify → Projeto Supabase PROD → CLERK_SECRET_KEY=sk_live_
```

Não é mais necessário trocar chaves manualmente; cada ambiente usa seu próprio projeto e variáveis.

---

## Deploy (Vercel, Netlify, etc.)

Configure as variáveis de **produção** no painel da plataforma:

- `VITE_SUPABASE_URL` = URL do projeto prod
- `VITE_SUPABASE_ANON_KEY` = anon key do projeto prod
- `VITE_CLERK_PUBLISHABLE_KEY` = `pk_live_...`

O build usará essas variáveis automaticamente.
