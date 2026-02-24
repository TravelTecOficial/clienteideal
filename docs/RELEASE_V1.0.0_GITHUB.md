# Documentação: Deploy Final v1.0.0 — GitHub

**Cliente Ideal Online** — Guia para o último deploy da versão v1.0.0 e encerramento do ciclo de desenvolvimento.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Checklist Pré-Release](#3-checklist-pré-release)
4. [Passos para Release no GitHub](#4-passos-para-release-no-github)
5. [Deploy em Produção](#5-deploy-em-produção)
6. [Encerramento do Projeto](#6-encerramento-do-projeto)
7. [Documentos Relacionados](#7-documentos-relacionados)

---

## 1. Visão Geral

Este documento descreve o processo completo para:

- **Commitar** todas as alterações pendentes
- **Criar a tag** `v1.0.0` no repositório
- **Publicar o Release** no GitHub
- **Executar o deploy** em produção
- **Encerrar** o ciclo de desenvolvimento da v1.0.0

---

## 2. Pré-requisitos

| Item | Verificação |
|------|-------------|
| Git configurado | `git config user.name` e `user.email` |
| Acesso ao repositório remoto | `git remote -v` |
| Node.js 18+ | `node -v` |
| Supabase CLI | `npx supabase --version` |
| Build local OK | `npm run build` sem erros |
| Lint OK | `npm run lint` sem erros |

---

## 3. Checklist Pré-Release

### 3.1 Código e Dependências

- [ ] `npm run build` executa sem erros
- [ ] `npm run lint` executa sem erros
- [ ] `package.json` com versão correta (`1.0.0` para release v1.0.0)
- [ ] Dependências atualizadas: `npm audit` sem vulnerabilidades críticas

### 3.2 Banco de Dados (Supabase)

- [ ] Todas as migrações em `supabase/migrations/` estão aplicadas em produção
- [ ] `npx supabase db diff` não mostra divergências (ou foram resolvidas)
- [ ] Backup do banco de produção realizado (recomendado)

### 3.3 Variáveis de Ambiente

- [ ] `.env.production` configurado (nunca commitado)
- [ ] Variáveis no painel Vercel/Netlify conferidas:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_CLERK_PUBLISHABLE_KEY`
  - `VITE_N8N_CHAT_WEBHOOK_URL` (opcional)

### 3.4 Documentação

- [ ] `README.md` atualizado com versão e links
- [ ] `CHANGELOG.md` com entrada da v1.0.0 completa
- [ ] `DEPLOY.md` revisado (se houver mudanças)

---

## 4. Passos para Release no GitHub

### 4.1 Verificar Status do Repositório

```powershell
git status
git branch
```

### 4.2 Commit de Alterações Pendentes

Se houver alterações não commitadas:

```powershell
# Adicionar todas as alterações relevantes
git add .

# Commit com mensagem descritiva
git commit -m "chore: preparar release v1.0.0 - migrações, templates, webhooks"
```

**Excluir do commit** (se aplicável):

- Arquivos em `.cursor/` (logs, debug)
- Arquivos temporários ou sensíveis

### 4.3 Ajustar Versão no package.json (se necessário)

Para release v1.0.0, garanta que `package.json` tenha:

```json
"version": "1.0.0"
```

Se estiver em 1.1.0 e o release for v1.0.0, avalie se deseja manter a versão atual ou fazer downgrade. Para um "fechamento" da v1.0.0, pode-se criar a tag a partir do commit que representa essa versão.

### 4.4 Push para o Repositório Remoto

```powershell
git push origin main
# ou: git push origin master
```

### 4.5 Criar a Tag v1.0.0

```powershell
# Tag anotada (recomendado)
git tag -a v1.0.0 -m "Release v1.0.0 - Cliente Ideal Online"

# Enviar a tag para o GitHub
git push origin v1.0.0
```

### 4.6 Criar o Release no GitHub

1. Acesse o repositório no GitHub
2. **Releases** → **Create a new release**
3. **Choose a tag**: selecione `v1.0.0`
4. **Release title**: `v1.0.0 - Cliente Ideal Online`
5. **Description**: copie o conteúdo da seção v1.0.0 do `CHANGELOG.md`
6. Marque **Set as the latest release**
7. Clique em **Publish release**

**Exemplo de descrição** (baseado no CHANGELOG):

```markdown
## Cliente Ideal Online v1.0.0

Plataforma SaaS de qualificação de leads e gestão comercial.

### Principais funcionalidades
- Cliente Ideal, Qualificador, Leads, Oportunidades
- Agenda, Atendimentos, Base de Conhecimento, Chat de Conhecimento
- Produtos e Serviços, Vendedores, Indicadores
- Integração Evolution API (WhatsApp), n8n
- Autenticação Clerk + Supabase
```

---

## 5. Deploy em Produção

Siga o guia [DEPLOY.md](../DEPLOY.md) para:

1. **Migrações** — `npx supabase db push` (se necessário)
2. **Edge Functions** — deploy de todas as functions
3. **Frontend** — build e deploy na Vercel/Netlify

### Edge Functions a deployar

```powershell
$PROJECT_REF = "bctjodobbsxieywgulvl"

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
```

*Se existirem `crm-webhook-stage-change`, `admin-persona-templates`, `admin-qualificacao-templates`, `persona-generate-avatar`, `persona-template-generate-avatar`, inclua-os conforme necessário.*

---

## 6. Encerramento do Projeto

### 6.1 Checklist Final

- [ ] Tag `v1.0.0` criada e publicada no GitHub
- [ ] Release publicado com descrição do CHANGELOG
- [ ] Deploy em produção concluído
- [ ] Smoke test: login, dashboard, principais fluxos
- [ ] Documentação arquivada e acessível

### 6.2 Arquivos de Referência

| Documento | Uso |
|-----------|-----|
| `README.md` | Visão geral do projeto |
| `CHANGELOG.md` | Histórico de alterações |
| `DEPLOY.md` | Guia de deploy |
| `docs/DOCUMENTACAO_SISTEMA_V1.md` | Documentação técnica completa |
| `docs/AMBIENTES-DEV-PROD.md` | Configuração de ambientes |

### 6.3 Próximos Passos (Opcional)

- Criar branch `main` protegida
- Configurar GitHub Actions para CI (lint, build) em futuras versões
- Documentar credenciais e acessos em local seguro (não no repositório)

---

## 7. Documentos Relacionados

| Documento | Descrição |
|-----------|-----------|
| [DEPLOY.md](../DEPLOY.md) | Guia de deploy para produção |
| [CHANGELOG.md](../CHANGELOG.md) | Histórico de alterações |
| [DOCUMENTACAO_SISTEMA_V1.md](./DOCUMENTACAO_SISTEMA_V1.md) | Documentação técnica do sistema |
| [AMBIENTES-DEV-PROD.md](./AMBIENTES-DEV-PROD.md) | Configuração dev vs prod |

---

*Documentação gerada para o release v1.0.0 — Cliente Ideal Online.*
