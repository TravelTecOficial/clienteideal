# Documentação Completa — Cliente Ideal Online v1.0.0

## Índice
1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Stack Tecnológica](#3-stack-tecnológica)
4. [Autenticação e Autorização](#4-autenticação-e-autorização)
5. [Fluxo de Usuário](#5-fluxo-de-usuário)
6. [Módulos do Sistema](#6-módulos-do-sistema)
7. [Modelo de Dados](#7-modelo-de-dados)
8. [Edge Functions (Supabase)](#8-edge-functions-supabase)
9. [Segurança](#9-segurança)
10. [Configuração e Deploy](#10-configuração-e-deploy)

---

## 1. Visão Geral

O **Cliente Ideal Online** é uma plataforma SaaS de qualificação de leads e gestão comercial que permite às empresas:

- **Definir perfis de cliente ideal** (ICP)
- **Criar qualificadores** com perguntas e respostas (fria, morna, quente)
- **Gerenciar leads** com status e vínculo ao cliente ideal
- **Acompanhar oportunidades** em pipeline com drag-and-drop
- **Agendar reuniões** em calendário
- **Visualizar atendimentos de IA** (conversas classificadas)
- **Manter base de conhecimento** (arquivos para treinamento)
- **Cadastrar produtos e serviços**
- **Convidar vendedores** via Clerk

O sistema é **multitenant**: cada empresa (company) tem seus próprios dados isolados por Row Level Security (RLS).

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                          │
│  ClerkProvider → BrowserRouter → SupabaseProvider → ProtectedRoute      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────────────┐
│         CLERK (Auth)           │   │            SUPABASE                     │
│  • Login / Signup              │   │  • PostgreSQL (RLS)                     │
│  • JWT (template: supabase)   │   │  • Edge Functions                       │
│  • Webhooks (user.created)    │   │  • Storage (futuro)                     │
│  • Invitations (vendedores)   │   │                                         │
└───────────────────────────────┘   └───────────────────────────────────────┘
```

### Camadas principais

| Camada | Tecnologia | Responsabilidade |
|--------|------------|------------------|
| **UI** | React 19, Radix UI, Tailwind | Componentes, formulários, feedback |
| **Estado** | React Context, Zustand (implícito) | UX apenas; não é fonte de verdade |
| **Roteamento** | React Router v7 | Rotas públicas e protegidas |
| **Auth** | Clerk | Identidade, sessão, JWT |
| **Backend** | Supabase | Banco de dados, RLS, Edge Functions |

---

## 3. Stack Tecnológica

| Categoria | Tecnologia |
|----------|------------|
| **Framework** | React 19.2, Vite 5 |
| **Linguagem** | TypeScript 5.4 |
| **Estilização** | Tailwind CSS 3.4, tailwindcss-animate |
| **Componentes** | Radix UI (accordion, dialog, select, tabs, etc.) |
| **Formulários** | react-hook-form, zod, @hookform/resolvers |
| **Autenticação** | Clerk 5.19 |
| **Backend** | Supabase 2.49 |
| **Calendário** | react-big-calendar, date-fns |
| **Drag & Drop** | @dnd-kit/core, @dnd-kit/sortable |
| **Gráficos** | Recharts |
| **Sanitização** | DOMPurify (para XSS) |

---

## 4. Autenticação e Autorização

### 4.1 Clerk

- **Publishable Key** (`VITE_CLERK_PUBLISHABLE_KEY`): usada no frontend; chave pública.
- **Secret Key** (`sk_...`): usada apenas em Edge Functions; nunca exposta no cliente.
- **JWT Template "supabase"**: configurado no painel Clerk para integração com RLS (Supabase usa `auth.jwt() ->> 'sub'`).

### 4.2 Fluxo de Autenticação

1. Usuário acessa `/entrar` ou `/cadastrar`.
2. Clerk gerencia login/signup.
3. Após login, `ProtectedRoute` verifica:
   - Usuário autenticado?
   - Plano válido (`plan_type` diferente de `none` ou vazio)?
   - Se não: redireciona para `/planos` ou `/entrar`.

### 4.3 Roles

| Tipo | Onde | Descrição |
|------|------|-----------|
| **Admin SaaS** | `Clerk publicMetadata.role === "admin"` | Gerencia todo o sistema; acessa `/admin` |
| **Admin** | `profiles.role === "admin"` | Admin da empresa (company) |
| **Vendedor** | `profiles.role === "vendedor"` | Usuário convidado para empresa específica |

> **Nota:** Em localhost, admins SaaS não são redirecionados automaticamente para `/admin`, permitindo testar fluxo normal.

---

## 5. Fluxo de Usuário

### 5.1 Rotas Públicas

| Rota | Descrição |
|------|-----------|
| `/` | Landing page |
| `/entrar` | Login (Clerk) |
| `/cadastrar` | Cadastro (Clerk) |
| `/planos` | Seleção de plano (requer autenticação) |

### 5.2 Rotas Protegidas (Dashboard)

| Rota | Módulo |
|------|--------|
| `/dashboard` | Visão geral |
| `/dashboard/cliente-ideal` | Perfis de cliente ideal |
| `/dashboard/qualificador` | Qualificadores |
| `/dashboard/leads` | Leads |
| `/dashboard/oportunidades` | Oportunidades (pipeline) |
| `/dashboard/agenda` | Agenda / Reuniões |
| `/dashboard/atendimentos` | Atendimentos IA |
| `/dashboard/base-conhecimento` | Base de conhecimento |
| `/dashboard/items` | Produtos e Serviços |
| `/dashboard/perfil` | Perfil do usuário |
| `/dashboard/vendedores` | Vendedores |
| `/admin` | Usuários do sistema (Admin SaaS) |
| `/admin/configuracoes` | Configurações (Admin SaaS) |

### 5.3 Fluxo de Seleção de Plano

1. Usuário faz cadastro no Clerk.
2. Webhook `clerk-webhook` cria `company` e `profile` no Supabase.
3. Usuário é redirecionado para `/planos` (se não tiver plano).
4. Usuário escolhe plano (free, pro, enterprise).
5. `updateCompanyPlan` atualiza `companies.plan_type`.
6. Navegação para `/dashboard` com `state.fromPlanSelection: true`.

Se o webhook falhar, o frontend chama a Edge Function `sync-profile-client` para criar/atualizar perfil sob demanda.

---

## 6. Módulos do Sistema

### 6.1 Cliente Ideal

**Rota:** `/dashboard/cliente-ideal`

Define perfis de cliente ideal (ICP) com campos como:
- `profile_name`, `age_range`, `gender`, `location`, `income_level`
- `job_title`, `goals_dreams`, `pain_points`, `values_list`
- `hobbies_interests`, `buying_journey`, `decision_criteria`
- `common_objections`, `target_product`

Usado em **Qualificador**, **Leads** e **Oportunidades** para vincular perguntas, leads e negócios ao perfil correto.

---

### 6.2 Qualificador

**Rota:** `/dashboard/qualificador`

Cria **qualificadores** (entidades com nome) que agrupam múltiplas perguntas. Cada pergunta pode ter até 3 respostas (fria, morna, quente).

**Fluxo de criação:**
1. Informar **nome** do qualificador e **Persona** (opcional)
2. Entrar em loop: adicionar pergunta + até 3 respostas (fria, morna, quente)
3. Botão "Adicionar outra pergunta" para incluir mais perguntas
4. "Salvar qualificador" persiste tudo em uma única transação

Cada qualificador pertence a uma empresa e pode ser vinculado a um perfil de cliente ideal.

---

### 6.3 Leads

**Rota:** `/dashboard/leads`

CRUD de leads com:
- Nome, e-mail, telefone
- Status: Novo, Em Contato, Qualificado, Perdido
- Vínculo com Cliente Ideal e Vendedor
- `external_id` para integração

---

### 6.4 Oportunidades

**Rota:** `/dashboard/oportunidades`

Pipeline visual com drag-and-drop (DnD Kit):
- **Estágios:** Novo → Qualificação → Negociação → Proposta → Ganho / Perdido
- Campos: título, valor, data prevista, vendedor, produto, cliente ideal
- Visualização em lista e grid

---

### 6.5 Agenda

**Rota:** `/dashboard/agenda`

Calendário de reuniões (react-big-calendar):
- Data/hora, tipo de reunião, vendedor
- Status: Pendente, Confirmado, Cancelado, Finalizado
- Abas: visualização calendário / lista

---

### 6.6 Atendimentos

**Rota:** `/dashboard/atendimentos`

Visualização de conversas de IA (read-only):
- Nome, celular, e-mail, idade, preferência
- Score final, classificação
- UTM (source, medium, campaign, etc.)
- Histórico em JSON

---

### 6.7 Base de Conhecimento

**Rota:** `/dashboard/base-conhecimento`

Gestão de arquivos para treinamento:
- Tipos: Produto, Serviço, Institucional, Outro
- Metadados: nome, descrição, `drive_file_id`
- Isolamento por empresa via RLS

---

### 6.8 Produtos e Serviços (Items)

**Rota:** `/dashboard/items`

Cadastro de produtos e serviços:
- Nome, descrição, preço, unidade, categoria
- Tipo: `product` ou `service`
- Importação em lote (CSV)

---

### 6.9 Vendedores

**Rota:** `/dashboard/vendedores`

- Cadastro de vendedores (nome, e-mail, celular)
- Horários de trabalho (entrada, saída, almoço por dia da semana)
- Convite via Clerk (`clerk-invite-vendedor`) com `company_id` no `publicMetadata`
- Atualização de `vendedores.clerk_id` quando o convidado aceita

---

### 6.10 Admin (SaaS)

**Rotas:** `/admin`, `/admin/configuracoes`

- Lista de usuários do sistema (profiles + companies)
- Acesso restrito a `publicMetadata.role === "admin"`
- Edge Function `admin-list-users` valida o token e retorna dados agregados

---

## 7. Modelo de Dados

### 7.1 Tabelas Principais

| Tabela | Descrição |
|-------|-----------|
| `profiles` | Usuários (id = Clerk user ID, company_id, role) |
| `companies` | Empresas (id, name, slug, plan_type, status) |
| `ideal_customers` | Perfis de cliente ideal |
| `qualificadores` | Qualificadores (nome, persona) |
| `qualificacao_perguntas` | Perguntas de cada qualificador |
| `qualificacao_respostas` | Respostas (fria/morna/quente) por pergunta |
| `leads` | Leads |
| `opportunities` | Oportunidades |
| `agenda` | Reuniões |
| `atendimentos_ia` | Conversas de IA |
| `kb_files_control` | Arquivos base de conhecimento |
| `items` | Produtos e serviços |
| `vendedores` | Vendedores da empresa |
| `horarios` | Horários de trabalho dos vendedores |

### 7.2 Esquema Resumido

```
profiles (id TEXT PK, company_id, email, full_name, role)
  └── company_id → companies(id)

companies (id TEXT PK, name, slug, plan_type, status)

ideal_customers (id, company_id, profile_name, ...)

qualificadores (id, company_id, nome, ideal_customer_id, ...)
  └── qualificacao_perguntas (id, qualificador_id, pergunta, peso, ordem)
        └── qualificacao_respostas (id, pergunta_id, resposta_texto, tipo: fria|morna|quente)

leads (id, company_id, ideal_customer_id, seller_id, status, ...)

opportunities (id, company_id, stage, title, value, ...)

agenda (id, company_id, data_hora, tipo_reuniao, vendedor_id, status, ...)

atendimentos_ia (id, company_id, id_vendedor, celular, score_final, ...)

kb_files_control (id, company_id, file_name, training_type, ...)

items (id, company_id, user_id, name, type, price, ...)

vendedores (id, company_id, email, nome, clerk_id, ...)
```

### 7.3 RLS

Todas as tabelas de negócio usam RLS com padrão:

```sql
company_id IN (
  SELECT company_id FROM profiles
  WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
)
```

O JWT do Clerk é enviado em cada requisição Supabase; o template `supabase` garante que `sub` seja o ID do usuário (ex: `user_xxx`).

---

## 8. Edge Functions (Supabase)

| Função | Trigger | Descrição |
|--------|---------|-----------|
| **clerk-webhook** | Webhook Clerk (`user.created`) | Cria `company` e `profile`; no convite, usa `publicMetadata.company_id` |
| **sync-profile-client** | Chamada do frontend | Sincroniza perfil sob demanda (fallback se webhook falhar) |
| **clerk-invite-vendedor** | Chamada do frontend | Envia convite Clerk com `company_id` no metadata |
| **admin-list-users** | Chamada do frontend | Lista usuários; apenas admin SaaS |
| **sync-profile** | Interno | Alternativa server-side de sync (se existir) |

### Secrets necessários (Supabase Edge Functions)

- `CLERK_WEBHOOK_SECRET`: Signing secret do webhook Clerk
- `CLERK_SECRET_KEY`: Secret Key do Clerk (`sk_...`)

---

## 9. Segurança

### 9.1 Princípios

- **Zero Trust:** Backend é fonte de verdade; estado React é só UX.
- **RLS:** Isolamento por empresa em todas as tabelas.
- **Validação:** Zod no frontend; backend deve revalidar sempre.
- **Sem chaves secretas no cliente:** Apenas `VITE_*` são expostas.

### 9.2 Proteções

- `ProtectedRoute`: verifica auth e plano; redireciona se inválido.
- Edge Functions: validam JWT com `verifyToken` do Clerk.
- `admin-list-users`: verifica `publicMetadata.role === "admin"` antes de retornar dados.
- DOMPurify para conteúdo HTML dinâmico (evitar XSS).

### 9.3 Observações

- `localStorage` para JWT não é recomendado (risco XSS); preferir cookies HttpOnly ou refresh tokens curtos.
- `profiles` e `companies` não expõem `password_hash`; interfaces tipadas evitam vazamento de campos sensíveis.

---

## 10. Configuração e Deploy

### 10.1 Variáveis de Ambiente (.env)

```env
# Supabase (obrigatório)
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica

# Clerk (obrigatório)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### 10.2 Secrets Supabase (Edge Functions)

```bash
supabase secrets set CLERK_WEBHOOK_SECRET=whsec_xxx
supabase secrets set CLERK_SECRET_KEY=sk_xxx
```

### 10.3 Clerk

1. Criar aplicação no [Clerk Dashboard](https://dashboard.clerk.com).
2. Configurar JWT template "supabase" para integração com Supabase.
3. Criar webhook para `user.created` apontando para a URL da Edge Function `clerk-webhook`.
4. Copiar Signing secret para `CLERK_WEBHOOK_SECRET`.

### 10.4 Scripts

```bash
npm run dev      # Desenvolvimento
npm run build    # Build de produção
npm run preview  # Preview do build
npm run lint     # ESLint
```

### 10.5 Estrutura de Pastas

```
src/
├── components/       # Componentes reutilizáveis
├── hooks/            # Hooks customizados
├── lib/              # Supabase, utils, use-saas-admin
├── pages/            # Páginas e rotas
│   ├── admin/
│   ├── dashboard/
│   └── ...
├── styleguide/       # Galeria de componentes
└── main.tsx
```

---

## Changelog da Versão 1.0.0

- Lançamento inicial com módulos: Cliente Ideal, Qualificador, Leads, Oportunidades, Agenda, Atendimentos, Base de Conhecimento, Produtos/Serviços, Vendedores.
- Autenticação via Clerk integrada ao Supabase com RLS.
- Plano de assinatura (free, pro, enterprise).
- Admin SaaS para gestão de usuários.
- Edge Functions para webhook, sync de perfil, convite de vendedores e listagem de usuários.

---

*Documentação gerada em fevereiro de 2025.*
