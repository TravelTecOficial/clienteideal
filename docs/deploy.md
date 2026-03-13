# Deploy — Cliente Ideal Online

Este documento é um **runbook** resumido para deploy do Cliente Ideal Online, cobrindo desde a preparação de ambientes até um check-list pós-deploy. Use em conjunto com:

- `DEPLOY.md` — guia detalhado de deploy.
- `docs/AMBIENTES-DEV-PROD.md` — configuração de ambientes dev/prod.
- `docs/RELEASE_V1.1.7_DEPLOY.md` — passo a passo específico desta versão.

---

## 1. Pré-requisitos

### Acesso e ferramentas

- Acesso ao projeto Supabase de **produção**.
- Acesso ao painel do **Clerk** (produção).
- Acesso ao provedor de deploy do frontend (Vercel, Netlify, etc.).
- **Supabase CLI** instalado (`npx supabase` ou binário local).
- Node.js 20+ no ambiente de build.

### Variáveis de ambiente — Frontend

No provedor de deploy (ou em `.env.production` quando for build manual), configure:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO_PROD.supabase.co
VITE_SUPABASE_ANON_KEY=anon_key_do_projeto_prod
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
```

> Apenas chaves **públicas** vão em `VITE_*`. Segredos devem ficar nas **Secrets** das Edge Functions do Supabase.

### Secrets — Supabase (produção)

No painel do Supabase, em **Edge Functions → Secrets**, configure pelo menos:

- `CLERK_SECRET_KEY` — Secret Key `sk_live_...` do Clerk.
- `CLERK_WEBHOOK_SECRET` — Signing secret do webhook Clerk (se usar webhook).
- `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_TOKEN_ENCRYPTION_KEY`, `META_GRAPH_VERSION` (opcional).
- `META_WHATSAPP_REDIRECT_URI`, se usar a nova integração WhatsApp Cloud API.
- `N8N_META_CONNECTIONS_API_KEY`, se usar a Edge Function `meta-connections-n8n` (n8n obtém IDs Meta por empresa).
- `LATE_API_KEY` — Chave da Late API (Google My Business / Social Hub).
- Outras chaves específicas de funções (ver comentários nos arquivos de `supabase/functions/*`).

---

## 2. Banco de dados (Supabase)

### 2.1 Linkar projeto de produção

No repositório local:

```bash
supabase link --project-ref SEU_PROJECT_REF_PROD
```

O `project-ref` pode ser encontrado no painel do Supabase (Settings → API).

### 2.2 Aplicar migrations

Certifique-se de que todas as migrations foram aplicadas ao projeto de produção:

```bash
supabase db push
```

Isso garante que migrations como:

- `20260227120000_leads_conversao.sql`
- `20260303110000_meta_instagram_integrations.sql`
- `20260304120000_meta_instagram_selection.sql`
- `20260305130000_integrations_whatsapp.sql`

estejam ativas em produção.

Opcionalmente, **revise** as migrations no painel (**SQL Editor**) antes de aplicar em produção, se houver dúvidas.

---

## 3. Edge Functions (Supabase)

### 3.1 Conferir secrets antes do deploy

Para cada função sensível, verifique os comentários no topo do arquivo em `supabase/functions/*/index.ts` para saber quais secrets são necessárias (ex.: `CLERK_SECRET_KEY`, `META_*`, `LATE_API_KEY`).

### 3.2 Deploy das funções

Exemplos (ajuste a lista conforme o que está em uso):

```bash
supabase functions deploy clerk-webhook
supabase functions deploy sync-profile-client
supabase functions deploy chat-conhecimento-proxy
supabase functions deploy evolution-proxy
supabase functions deploy evolution-webhook
supabase functions deploy admin-webhook-config
supabase functions deploy admin-evolution-config
supabase functions deploy admin-gtm-config
supabase functions deploy upload-kb-to-webhook
supabase functions deploy persona-generate-avatar
supabase functions deploy persona-template-generate-avatar

# Integrações novas
supabase functions deploy meta-instagram
supabase functions deploy meta-connections-n8n
supabase functions deploy whatsapp-integration
supabase functions deploy gmb-post-create
```

> Algumas funções específicas podem exigir `--no-verify-jwt` (como `gmb-post-create`, conforme comentário no arquivo). Use exatamente as flags indicadas nos comentários da função.

---

## 4. Frontend (build e deploy)

### 4.1 Build de produção

No repositório:

```bash
npm install       # ou pnpm install
npm run build
```

Certifique-se de que o build está lendo as variáveis de produção (`.env.production` ou variáveis do provedor).

### 4.2 Preview local (opcional)

```bash
npm run preview
```

Acesse `http://localhost:4173` e valide:

- Login/logout.
- Acesso ao dashboard.
- Navegação básica pelos módulos (leads, oportunidades, indicadores).

### 4.3 Deploy em Vercel/Netlify (ou similar)

- Configure o repositório Git no provedor.
- Defina:
  - Comando de build: `npm run build`.
  - Diretório de saída: `dist`.
- Configure as variáveis de ambiente de produção no painel do provedor (as mesmas de `VITE_*`).
- Faça o primeiro deploy e aguarde a finalização.

---

## 5. Integrações pós-deploy

### 5.1 Clerk

- Garanta que:
  - `VITE_CLERK_PUBLISHABLE_KEY` (prod) está correto.
  - Template JWT `supabase` está configurado.
  - Webhook `user.created` (se usado) aponta para a URL de produção da função `clerk-webhook`.

### 5.2 n8n (webhooks)

- No módulo Admin SaaS (`/admin`):
  - Configure ou revise `admin_webhook_config` para cada `segment_type` relevante:
    - `webhook_producao` (chat de conhecimento).
    - `webhook_teste`.
    - `webhook_enviar_arquivos`.
- Teste:
  - Chat de Conhecimento.
  - Upload de arquivos da base de conhecimento.

### 5.3 WhatsApp

#### Evolution API (legado)

- Em `/admin/evolution`, configure:
  - URL base da Evolution API.
  - API Key.
- Teste:
  - Conexão da instância.
  - Recebimento de mensagens via `evolution-webhook`.

#### WhatsApp Cloud API (Embedded Signup)

- Certifique-se de que as secrets `META_APP_ID`, `META_APP_SECRET`, `META_TOKEN_ENCRYPTION_KEY` e `META_GRAPH_VERSION` estão configuradas no Supabase.
- No frontend, configure `VITE_META_APP_ID` (mesmo valor de `META_APP_ID`) para o SDK da Meta.
- No dashboard:
  - Clique em "Conectar WhatsApp" na aba Integrações (`/dashboard/configuracoes?tab=integracoes`).
  - O popup Embedded Signup da Meta será exibido; após autorizar, o número será vinculado automaticamente.

### 5.4 Meta / Instagram

- Secrets configuradas (`META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_TOKEN_ENCRYPTION_KEY`, etc.).
- No dashboard:
  - Conecte a conta da Meta pela UI.
  - Selecione página e conta Instagram associada.
  - Valide se os gráficos de indicadores sociais carregam corretamente.

### 5.5 Google My Business / Social Hub

- Configure `LATE_API_KEY` nas secrets do Supabase.
- Garanta que `gmb_accounts` tenha os `late_account_id` corretos por empresa.
- No módulo Social Hub:
  - Crie um post de teste e verifique se ele aparece no Google Business via Late.

---

## 6. Check-list pós-deploy

Use esta lista rápida após cada deploy:

1. **Aplicação web**
   - [ ] Landing page carrega sem erros.
   - [ ] Login via Clerk funciona (signup + login).
   - [ ] Dashboard abre para usuário de teste.
2. **Dados e RLS**
   - [ ] Usuário só enxerga dados da sua empresa (testar com 2 empresas diferentes).
   - [ ] Admin SaaS consegue usar `/admin` e `/admin/preview/:companyId`.
3. **Módulos principais**
   - [ ] CRUD de leads (`/dashboard/leads`) funcionando, incluindo campo `conversao`.
   - [ ] Pipeline de oportunidades (`/dashboard/oportunidades`) funcionando (drag-and-drop).
   - [ ] Agenda, atendimentos IA, base de conhecimento acessíveis.
4. **Integrações**
   - [ ] Chat de Conhecimento responde com base em documentos da empresa.
   - [ ] Evolution API (se em uso) envia/recebe mensagens.
   - [ ] WhatsApp via Meta conectado e número selecionado.
   - [ ] Meta/Instagram conectado; gráficos de alcance exibidos.
   - [ ] Social Hub consegue publicar em GMB via Late API.
5. **Monitoramento e erros**
   - [ ] Console do navegador sem erros críticos.
   - [ ] Logs das Edge Functions no Supabase sem erros recorrentes.

---

## 7. Troubleshooting rápido

- **Erro de RLS / acesso negado**:
  - Verifique se o usuário possui `profile` com `company_id`.
  - Confira se o JWT do Clerk está usando o template correto (`supabase`).
- **Erro em Edge Function com "Invalid JWT"**:
  - Veja se a função exige `--no-verify-jwt` (como `gmb-post-create`).
  - Garanta que o frontend está enviando `Authorization: Bearer <clerk_jwt>` quando necessário.
- **Integrações Meta/WhatsApp falhando com mensagem enigmática**:
  - Verifique se as secrets `META_*` estão corretas e se o redirect URI bate com o configurado na Meta.
  - Refaça o fluxo de conexão na UI (desconectar e conectar novamente).

Para mais detalhes, consulte os documentos específicos (`docs/AMBIENTES-DEV-PROD.md`, `docs/RELEASE_V1.1.7_DEPLOY.md` e comentários nos próprios arquivos de Edge Functions).

