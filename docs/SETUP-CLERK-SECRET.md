# Configurar CLERK_SECRET_KEY no Supabase

O erro **"No suitable key or wrong key type"** aparece quando a Edge Function `sync-profile-client` não consegue validar o JWT do Clerk. A causa é: **Secret Key ausente ou incorreta** nos Secrets do Supabase.

## ⚠️ Erro comum

- **Usou `pk_test_...` (Publishable Key)?** → Precisa da **Secret Key** (`sk_test_...` ou `sk_live_...`).
- **Projeto errado?** → Localhost usa projeto **dev** (`mrkvvgofjyvlutqpvedt`). Produção usa **prod** (`bctjodobbsxieywgulvl`).
- **Chave de outro projeto Clerk?** → A Secret Key deve ser da **mesma aplicação** do `pk_test_...` no `.env.local`.

## Guia rápido (3 passos)

### 1. Copiar a Secret Key do Clerk

1. **[Abrir Clerk → API Keys](https://dashboard.clerk.com)** (mesma app do seu `pk_test_...`)
2. Em **Secret keys**, clique em **Reveal** na chave de **desenvolvimento**
3. Copie o valor que começa com `sk_test_`

### 2. Colar no Supabase

1. **Localhost:** [Supabase DEV – Secrets](https://supabase.com/dashboard/project/mrkvvgofjyvlutqpvedt/settings/functions)
2. **Produção:** [Supabase PROD – Secrets](https://supabase.com/dashboard/project/bctjodobbsxieywgulvl/settings/functions)
3. Clique em **Add new secret** → **Name:** `CLERK_SECRET_KEY` → **Value:** cole `sk_test_...` → **Save**

### 3. Testar

1. `npm run dev` (se necessário)
2. Logout e login novamente
3. A sincronização deve concluir e você será redirecionado ao dashboard

---

**Via CLI** (com `supabase link` feito):

```bash
supabase secrets set CLERK_SECRET_KEY=sk_test_sua_chave_aqui
```

Se o erro continuar, confira no Clerk se o JWT template **"supabase"** está configurado (**JWT Templates** no menu lateral).
