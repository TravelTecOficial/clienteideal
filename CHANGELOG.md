# Changelog

Todas as alterações relevantes do projeto são documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e o projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [1.1.0] - 2026-02-18

### Adicionado

- **Configurações → Empresa** — Novo módulo para nome da empresa, apresentação e histórico.
- **Admin de Templates** — Gestão de modelos globais de persona e qualificação.
- **Avatares de Persona** — Suporte a geração/uso de avatar para personas e templates.

### Corrigido

- **Cliente Ideal em produção** — Fallback na listagem quando `avatar_url` ainda não existe no schema.
- **Popup de rede local/CORS** — Remoção de chamadas de debug para `127.0.0.1:7243` no frontend.

### Banco de Dados

- **`companies`** — Novas colunas `description` e `history`.
- **`ideal_customers`** — Migration de reparo para garantir a coluna `avatar_url`.

---

## [1.0.0] - 2025-02-18

### Adicionado

#### Módulos do Dashboard

- **Cliente Ideal** — Perfis de cliente ideal (ICP) com campos detalhados
- **Qualificador** — Qualificadores com perguntas e respostas (fria, morna, quente)
- **Leads** — CRUD de leads com status e vínculo a cliente ideal/vendedor
- **Oportunidades** — Pipeline visual com drag-and-drop (DnD Kit)
- **Agenda** — Calendário de reuniões (react-big-calendar)
- **Atendimentos** — Visualização de conversas de IA (read-only)
- **Base de Conhecimento** — Gestão de arquivos para treinamento
- **Chat de Conhecimento** — Assistente IA que consulta documentos via n8n
- **Produtos e Serviços** — Cadastro de items com importação CSV
- **Vendedores** — Cadastro e convite via Clerk
- **Indicadores** — KPIs, funil de vendas, gráficos (Recharts)
- **Consórcio** — Módulo específico
- **Configurações** — Configurações da empresa

#### Páginas Públicas

- **Landing Page** — Página inicial
- **Preços** — Página de preços
- **Login / Cadastro** — Via Clerk

#### Admin SaaS

- **Admin** — Lista de usuários e empresas
- **Admin Configurações** — Webhooks n8n (Consórcio, Produtos, Chat)
- **Admin Evolution** — Configuração da Evolution API (WhatsApp)
- **Admin Preview** — Visualizar dashboard como empresa

#### Autenticação e Autorização

- Autenticação via Clerk
- Integração com Supabase via JWT template "supabase"
- RLS em todas as tabelas de negócio
- Plano de assinatura (free, pro, enterprise)
- `ProtectedRoute` para verificação de auth e plano

#### Edge Functions

- `clerk-webhook` — Webhook para user.created
- `sync-profile-client` — Sincronização de perfil sob demanda
- `sync-profile` — Sync server-side
- `clerk-invite-vendedor` — Convite de vendedores
- `admin-list-users` — Listagem de usuários (admin)
- `admin-list-companies` — Listagem de empresas (admin)
- `admin-update-company` — Atualização de empresa (admin)
- `admin-webhook-config` — CRUD de webhooks n8n
- `admin-evolution-config` — CRUD de Evolution API
- `evolution-proxy` — Proxy para Evolution API
- `evolution-webhook` — Recebe mensagens da Evolution
- `chat-conhecimento-proxy` — Proxy para Chat de Conhecimento
- `upload-kb-to-webhook` — Envio de arquivos ao n8n

#### Integrações

- **Evolution API** — WhatsApp via proxy
- **n8n** — Webhooks para chat, consórcio, produtos

#### Stack

- React 19.2, Vite 5, TypeScript 5.4
- Tailwind CSS, Radix UI, Shadcn
- Supabase, Clerk
- react-hook-form, zod, Recharts, react-big-calendar, @dnd-kit

### Corrigido

- **Popup de rede local** — Removida instrumentação de debug que enviava requisições para `127.0.0.1:7243` em produção. O popup "clienteideal.online quer buscar e se conectar a qualquer dispositivo na sua rede local" era causado por essas chamadas; o navegador interpretava como acesso à rede privada (Private Network Access), exigindo permissão do usuário. Arquivos afetados: `ProtectedRoute.tsx`, `chat-conhecimento/index.tsx`, `use-evolution-proxy.ts`, `Planos.tsx`, `evolution-proxy`, `chat-conhecimento-proxy`.

### Segurança

- Zero Trust: backend é fonte de verdade
- RLS em todas as tabelas
- Sem chaves secretas no cliente
- DOMPurify para conteúdo HTML dinâmico (XSS)

---

*Documentação gerada em fevereiro de 2025.*
