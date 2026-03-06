# Cliente Ideal Online v1.1.7

Plataforma SaaS de **qualificação de leads e gestão comercial**, com módulos de cliente ideal (ICP), qualificadores, leads, oportunidades, agenda, atendimentos de IA, base de conhecimento, indicadores, consórcio e painel administrativo SaaS. O sistema é **multitenant**, com isolamento por empresa via RLS no Supabase.

---

## Visão geral técnica

- **Frontend**: React 19 + Vite 5 + TypeScript
- **UI/UX**: Tailwind CSS, Radix UI, componentes próprios
- **Autenticação**: Clerk (JWT template `supabase`)
- **Backend/BaaS**: Supabase (PostgreSQL + Row Level Security + Edge Functions)
- **Integrações**:
  - Chat de conhecimento via n8n (webhooks por segmento)
  - WhatsApp (Evolution API e nova integração via Meta/WhatsApp Cloud API)
  - Integrações sociais (Meta/Instagram, Google My Business / Social Hub)

Para detalhes completos de módulos, rotas, modelo de dados e Edge Functions, veja a documentação principal em [`docs/DOCUMENTACAO_SISTEMA_V1.md`](./docs/DOCUMENTACAO_SISTEMA_V1.md).

---

## Stack principal

| Categoria        | Tecnologia                                                                 |
|-----------------|----------------------------------------------------------------------------|
| Framework        | React 19.2, Vite 5                                                        |
| Linguagem        | TypeScript 5.4                                                            |
| Roteamento       | React Router v7                                                           |
| Estilo/UI        | Tailwind CSS 3.4, tailwindcss-animate, Radix UI                          |
| Formulários      | react-hook-form, zod, @hookform/resolvers                                |
| Gráficos         | Recharts                                                                  |
| Calendário       | react-big-calendar, date-fns                                              |
| Drag & Drop      | @dnd-kit/core, @dnd-kit/sortable                                          |
| Backend/Banco    | Supabase (PostgreSQL + RLS + Edge Functions)                              |
| Autenticação     | Clerk (publishable key no frontend; secret key apenas em Edge Functions) |
| Sanitização HTML | DOMPurify                                                                 |

---

## Como rodar localmente

### Pré-requisitos

- Node.js 20+ (ou versão LTS estável)
- Gerenciador de pacotes (`npm`, `pnpm` ou `yarn`)
- Acesso a um projeto Supabase de desenvolvimento (com migrations aplicadas)
- Projeto Clerk configurado com template JWT `supabase`

### 1. Instalar dependências

```bash
npm install
# ou
pnpm install
```

### 2. Configurar variáveis de ambiente (desenvolvimento)

Crie um arquivo `.env.local` na raiz (não deve ser commitado) com as chaves **públicas**:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO_DEV.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_publica
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

> Segredos como `CLERK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e chaves privadas de integrações devem ficar **apenas** nas secrets das Edge Functions do Supabase, nunca em variáveis `VITE_` ou código do frontend.

Para guias mais completos de ambientes, consulte [`docs/AMBIENTES-DEV-PROD.md`](./docs/AMBIENTES-DEV-PROD.md).

### 3. Rodar o projeto em desenvolvimento

```bash
npm run dev
```

Aplicação será iniciada em `http://localhost:5173` (porta padrão do Vite).

---

## Build e preview de produção (resumo)

```bash
npm run build    # Gera build de produção
npm run preview  # Sobe o build localmente para validação
```

Para detalhes de deploy (Supabase, ambientes dev/prod, variáveis de produção), consulte:

- [`DEPLOY.md`](./DEPLOY.md) – guia geral de deploy
- [`docs/AMBIENTES-DEV-PROD.md`](./docs/AMBIENTES-DEV-PROD.md) – separação dev vs prod
- [`docs/RELEASE_V1.1.7_DEPLOY.md`](./docs/RELEASE_V1.1.7_DEPLOY.md) – passo a passo específico desta versão

---

## Estrutura de pastas (resumo)

```text
src/
├── components/        # Componentes de UI e blocos reutilizáveis
├── hooks/             # Hooks customizados
├── lib/               # Configurações de Supabase, helpers, integrações
├── pages/
│   ├── admin/         # Rotas do admin SaaS
│   ├── auth/          # Auth, callbacks e fluxos de integração
│   ├── dashboard/     # Módulos principais (leads, oportunidades, indicadores, etc.)
│   └── ...            # Outras páginas
└── main.tsx           # Bootstrap do app React

supabase/
├── migrations/        # Migrations SQL do banco
└── functions/         # Edge Functions (Clerk, integrações, chat de conhecimento, etc.)
```

Para uma visão detalhada de rotas, módulos e tabelas, veja [`docs/DOCUMENTACAO_SISTEMA_V1.md`](./docs/DOCUMENTACAO_SISTEMA_V1.md).

---

## Documentação adicional

| Documento | Descrição |
|----------|-----------|
| [`docs/DOCUMENTACAO_SISTEMA_V1.md`](./docs/DOCUMENTACAO_SISTEMA_V1.md) | Visão geral completa, arquitetura, módulos, Edge Functions |
| [`docs/architecture.md`](./docs/architecture.md) | Arquitetura de alto nível, camadas e fluxos principais |
| [`docs/integrations.md`](./docs/integrations.md) | Integrações (Clerk, n8n, WhatsApp, Meta/Instagram, GMB/Social Hub) |
| [`docs/database.md`](./docs/database.md) | Visão geral do schema e principais tabelas/migrations |
| [`docs/deploy.md`](./docs/deploy.md) | Runbook de deploy (check-list) |
| [`docs/security.md`](./docs/security.md) | Diretrizes de segurança, RLS e uso de secrets |
| [`CHANGELOG.md`](./CHANGELOG.md) | Histórico de alterações |
| [`DEPLOY.md`](./DEPLOY.md) | Guia geral de deploy para produção |
| [`docs/RELEASE_V1.0.0_GITHUB.md`](./docs/RELEASE_V1.0.0_GITHUB.md) | Release v1.0.0 (deploy final no GitHub) |
| [`docs/RELEASE_V1.1.7_DEPLOY.md`](./docs/RELEASE_V1.1.7_DEPLOY.md) | Release v1.1.7 (passos específicos) |
| [`docs/AMBIENTES-DEV-PROD.md`](./docs/AMBIENTES-DEV-PROD.md) | Configuração de ambientes dev e prod |
| [`docs/LEADS_API_PAYLOAD.md`](./docs/LEADS_API_PAYLOAD.md) | Payload de leads para integrações (n8n, webhooks, formulários) |
| [`docs/SETUP-CLERK-SUPABASE-AUTH.md`](./docs/SETUP-CLERK-SUPABASE-AUTH.md) | Setup Clerk + Supabase (auth e RLS) |
| [`docs/SETUP-CLERK-SECRET.md`](./docs/SETUP-CLERK-SECRET.md) | Configuração de secrets do Clerk e templates |

