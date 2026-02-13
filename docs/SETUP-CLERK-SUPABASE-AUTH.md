# Configurar Clerk como provedor de auth no Supabase

**Problema:** Erro 401 ao acessar `profiles` ou redirecionamento para /planos. O Supabase não reconhece o JWT do Clerk.

**Solução:** Third-Party Auth (Clerk) no Supabase + claim `role` no token de sessão do Clerk.

## Passo 1: Clerk – Adicionar claim `role` no token de sessão

1. [Clerk Dashboard](https://dashboard.clerk.com) → sua aplicação
2. **Sessions** (menu lateral) → **Customize session token**
3. No editor de **Claims**, adicione:
   ```json
   {
     "role": "authenticated"
   }
   ```
4. **Save**

## Passo 2: Supabase – Adicionar Third-Party Auth (Clerk)

1. [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione o projeto (dev: `mrkvvgofjyvlutqpvedt` ou prod: `bctjodobbsxieywgulvl`)
3. **Authentication** → **Providers** (ou **Sign In / Up**)
4. Aba **Third-Party Auth**
5. **Add provider** → **Clerk**
6. **Domain:** `artistic-stingray-67.clerk.accounts.dev` (sem `https://`)
7. **Save**

## Passo 3: Repetir em ambos os projetos Supabase

- **Dev** (localhost): [mrkvvgofjyvlutqpvedt](https://supabase.com/dashboard/project/mrkvvgofjyvlutqpvedt/auth/providers)
- **Prod**: [bctjodobbsxieywgulvl](https://supabase.com/dashboard/project/bctjodobbsxieywgulvl/auth/providers)

---

Após configurar, faça **logout e login** no app. O `auth.jwt() ->> 'sub'` funcionará nas políticas RLS.
