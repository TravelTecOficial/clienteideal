# Segurança — Cliente Ideal Online

Este documento consolida as principais decisões e recomendações de segurança do projeto, com foco em:

- Autenticação e autorização.
- Isolamento de dados entre empresas (multi-tenant).
- Manuseio de segredos e integrações externas.
- Boas práticas em React/SPA.

---

## Princípios gerais

- **Zero Trust**:
  - O backend (Supabase + Edge Functions) é a **única fonte de verdade** para regras de negócio e permissões.
  - Estado no frontend (React, contextos, hooks) é **apenas UX**.
- **RLS em todas as tabelas de negócio**:
  - Acesso sempre filtrado por `company_id` baseado no `sub` do JWT do Clerk.
- **Sem segredos no cliente**:
  - Nenhuma chave privada (Supabase service role, Clerk secret, API Keys de provedores, etc.) aparece em código do frontend ou variáveis `VITE_*`.

---

## Autenticação e autorização

### Clerk + Supabase

- A autenticação é delegada ao **Clerk**.
- O template JWT `supabase` garante que:
  - `auth.jwt() ->> 'sub'` no Supabase corresponde ao `userId` do Clerk.
- Edge Functions validam o JWT com:

  - `verifyToken(token, { secretKey: CLERK_SECRET_KEY })`.

### Roles e perfis

- Roles principais:
  - **Admin SaaS**: controla configurações globais (`/admin`, webhooks, Evolution, GTM, etc.).
  - **Admin de empresa**: gerencia dados da própria empresa (configurações, vendedores, etc.).
  - **Vendedor**: opera leads, oportunidades, agenda e demais módulos de vendas.
- As permissões são compostas por:
  - Checagens no frontend (UX, redirecionamentos).
  - RLS e validações em Edge Functions (segurança real).

> Comentários em funções críticas destacam quando um check é apenas nível UI (`// Note: UI-level check only. API enforcement required.`).

---

## RLS (Row Level Security)

Política base típica para tabelas multi-tenant:

```sql
company_id IN (
  SELECT company_id
  FROM profiles
  WHERE id = (auth.jwt() ->> 'sub')
    AND company_id IS NOT NULL
);
```

Pontos de atenção:

- As migrations devem sempre:
  - Criar/alterar tabelas.
  - Configurar as políticas de RLS correspondentes.
- Ações de admin SaaS que precisam ver múltiplas empresas são:
  - Implementadas via Edge Functions específicas para admin.
  - Checam metadata de role (por exemplo, `saas_admin`) antes de retornar dados.

---

## Segredos e variáveis de ambiente

### Frontend (`VITE_*`)

- Podem conter **apenas**:
  - URLs públicas (ex.: `VITE_SUPABASE_URL`).
  - Chaves públicas (ex.: `VITE_SUPABASE_ANON_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`).
- Nunca colocar:
  - `SUPABASE_SERVICE_ROLE_KEY`.
  - `CLERK_SECRET_KEY`.
  - Chaves da Meta, WhatsApp, Evolution, Google OAuth, etc.

### Supabase — Edge Functions

- Secrets configuradas via `supabase secrets set`:
  - `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`.
  - `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_WHATSAPP_REDIRECT_URI`, `META_TOKEN_ENCRYPTION_KEY`, etc.
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY` (Google My Business / Social Hub).
  - Outras chaves específicas de integrações.
- Edge Functions acessam essas secrets via `Deno.env.get(...)` e **nunca** as retornam para o cliente.

---

## Integrações externas com foco em segurança

### Meta / Instagram

- Função `meta-instagram`:
  - Valida JWT do Clerk via `CLERK_SECRET_KEY`.
  - Armazena `access_token` da Meta em `meta_instagram_integrations.access_token_encrypted` usando AES-GCM com `META_TOKEN_ENCRYPTION_KEY`.
  - Retorna ao frontend apenas:
    - Lista de páginas.
    - IDs/nomes de contas Instagram.
    - Métricas agregadas (reach, page impressions, etc.).
- Tokens nunca são expostos ao cliente.

### WhatsApp Cloud API (Meta)

- Função `whatsapp-integration`:
  - Recebe `action` + `code` + `token` (JWT do Clerk) do frontend.
  - Usa secrets `META_APP_ID`, `META_APP_SECRET`, `META_WHATSAPP_REDIRECT_URI`.
  - Salva acesso em `integrations` com `provider = "whatsapp"`.
  - Retorna apenas:
    - Lista de números disponíveis.
    - Status de sucesso/erro.

### Evolution API (legado)

- Funções `evolution-proxy` e `evolution-webhook`:
  - Leem a URL e API Key de configuração segura (tabela/admin ou secrets).
  - Frontend nunca conhece a API Key.
  - Eventos de entrada/saída passam pelo Supabase, permitindo auditar e aplicar regras.

### Google My Business / Social Hub

- Função `gmb-post-create`:
  - Valida JWT do Clerk e carrega `company_id` via `profiles`.
  - Garante que o usuário tem acesso à empresa via `profiles.company_id` ou `saas_admin`.
  - Usa `google_connections` e `selected_property_name` para autenticar na API do Google.
  - Tokens de acesso são criptografados e armazenados apenas no servidor.

---

## Boas práticas em React/SPA

### Armazenamento de tokens

- Preferencialmente:
  - Deixar o Clerk gerenciar sessão.
  - Evitar manipular tokens manualmente no frontend.
- Observações:
  - `localStorage` para JWT é frágil perante XSS.
  - Caso a arquitetura evolua para tokens próprios:
    - Preferir cookies `HttpOnly` + `Secure` com expiração curta.

### XSS e conteúdo dinâmico

- Uso de `DOMPurify` para qualquer HTML vindo de:
  - Conteúdos de base de conhecimento.
  - Respostas de IA que contenham HTML.
- Regras:
  - Evitar `dangerouslySetInnerHTML` sempre que possível.
  - Quando inevitável, garantir que o conteúdo foi sanitizado antes.
  - Evitar espalhar props arbitrárias em elementos DOM (`{...props}`) sem controle da origem.

### Tipagem e vazamento de dados

- Todas as interações com a API/Supabase devem ser tipadas em TypeScript.
- Evitar:
  - Usar `any` em respostas de API.
  - Passar objetos completos para componentes quando apenas alguns campos são necessários.
- Isso ajuda a:
  - Não vazar campos internos como IDs sensíveis, configurações internas, etc.
  - Facilitar auditorias de segurança de dados.

---

## Logs, debug e ambientes

- Logs detalhados:
  - São importantes em desenvolvimento, mas devem ser revisados em produção.
  - Evitar logar payloads completos de tokens ou dados altamente sensíveis.
- Ambientes:
  - `docs/AMBIENTES-DEV-PROD.md` descreve como separar dev/prod sem trocar chaves manualmente.
  - Funções que usam endpoints locais ou de debug devem ser revistas antes de deploy em produção.

---

## Recomendações para evoluções futuras

- **Autenticação**:
  - Se forem adicionados tokens próprios além do Clerk, considerar:
    - Refresh tokens de curta duração.
    - Cookies `HttpOnly` + `Secure` + `SameSite=Lax`.
- **Auditoria**:
  - Introduzir tabelas de log para ações administrativas críticas (alterar plano, mexer em webhooks, etc.).
- **Hardening de RLS**:
  - Revisar periodicamente políticas de RLS ao adicionar novas colunas e relacionamentos.

Este documento deve ser mantido atualizado sempre que novas integrações ou fluxos sensíveis forem adicionados ao sistema.

