# PRD - Autenticação, Sincronização e Segurança

## 1. Visão Geral
Este documento define a arquitetura de autenticação e o fluxo de dados entre **Clerk** (Identidade) e **Supabase** (Banco de Dados). O objetivo é garantir um ambiente SaaS multi-tenant, onde os dados são isolados por empresa e a sincronização entre plataformas é resiliente e segura.

## 2. Arquitetura do Sistema

### 2.1 Stack Técnica
* **Identidade:** Clerk (Provider de Auth).
* **Banco de Dados:** Supabase (PostgreSQL).
* **Sincronização:** Supabase Edge Functions (Deno) acionadas por Webhooks.
* **Protocolo de Auth:** JWT (JSON Web Tokens) com algoritmo HS256.

---

## 3. Integração JWT (Clerk + Supabase)
Para permitir que o frontend faça consultas seguras diretamente ao Supabase usando a sessão ativa do Clerk, as seguintes configurações foram aplicadas:

* **Algoritmo de Assinatura:** HS256.
* **Custom Signing Key:** Foi configurado no Clerk o **JWT Secret** originário do Supabase.
* **Claims Customizados (Template Clerk):**
    ```json
    {
      "aud": "authenticated",
      "role": "authenticated",
      "email": "{{user.primary_email_address}}"
    }
    ```

---

## 4. Sincronização via Webhook
A criação automática de perfis e empresas no banco de dados ocorre via Edge Function quando um novo usuário se cadastra.

### 4.1 Endpoint: `clerk-webhook`
* **Trigger:** Evento `user.created` disparado pelo Clerk.
* **Segurança:** Validação de assinatura `svix` utilizando a variável de ambiente `CLERK_WEBHOOK_SECRET` no Supabase.
* **Fluxo de Execução:**
    1.  Recebe o ID do usuário (Clerk) e o e-mail.
    2.  Cria um registro na tabela `companies` com UUID gerado pelo Supabase.
    3.  Cria o registro na tabela `profiles` vinculando o ID string do Clerk ao `company_id` recém-gerado.

---

## 5. Modelagem de Dados (Schema)

### Tabela: `profiles`
| Coluna | Tipo | Restrição | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | **TEXT** | PRIMARY KEY | ID do usuário vindo do Clerk (ex: `user_...`) |
| `email` | **TEXT** | **UNIQUE** | E-mail do usuário (único no sistema) |
| `company_id` | **UUID** | FOREIGN KEY | Referência à tabela `companies` |
| `role` | **TEXT** | DEFAULT 'admin' | Nível de permissão do usuário |

### Tabela: `companies`
| Coluna | Tipo | Restrição | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | **UUID** | PRIMARY KEY | Identificador único gerado pelo banco |
| `name` | **TEXT** | - | Nome da organização ou empresa |

---

## 6. Segurança e Isolamento (RLS)
Implementamos **Row Level Security** (RLS) para garantir o isolamento total entre diferentes empresas:

* **Acesso ao Perfil:** O usuário só pode ler e editar o registro onde `profiles.id` é igual ao seu `auth.uid()::text`.
* **Acesso à Empresa:** O usuário só pode visualizar a linha na tabela `companies` se o seu `profiles.company_id` for correspondente.
* **Conversão de Tipo:** Todas as políticas utilizam o casting `::text` para garantir compatibilidade entre o ID do Clerk (string) e os filtros do Supabase.

---

## 7. Comandos de Manutenção e Deploy (CLI)

Comandos executados via terminal para manter a infraestrutura:

```bash
# Autenticar na conta Supabase
npx supabase login

# Vincular o projeto local ao projeto remoto
npx supabase link --project-ref bctjodobbsxieywgulvl

# Configurar a chave secreta para validação do Webhook
npx supabase secrets set CLERK_WEBHOOK_SECRET=whsec_...

# Realizar o deploy da Edge Function ignorando validação interna de JWT
npx supabase functions deploy clerk-webhook --no-verify-jwt