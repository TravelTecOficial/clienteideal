# Social Hub - Regras de Segurança (RLS) e Backend

Documentação para o desenvolvedor que implementar o backend do módulo Social Media.

## Isolamento Multitenant

- O conteúdo de uma empresa **nunca** deve ser visível para outra.
- O filtro obrigatório em todas as queries é `company_id`.
- Ao buscar dados do Supabase, usar `useEffectiveCompanyId()` para obter o `company_id` do contexto (perfil do usuário ou preview do admin).

## Perfil de Usuário

| Perfil | Permissões |
|--------|------------|
| **Admins da Empresa** | Controle total sobre o Social Hub (CRUD) |
| **Vendedores** | Visualizar ou criar conteúdos, conforme `profiles.role` e permissões atribuídas |

## Autenticação

- O acesso à rota `/dashboard/social-hub` é validado pelo `ProtectedRoute`.
- O `ProtectedRoute` verifica:
  - Usuário logado via Clerk
  - Plano ativo (`plan_type !== 'none'`)

## Relacionamento com o Banco de Dados

### Tabela sugerida: `social_hub_content` (ou similar)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK para `companies(id)` - filtro multitenant |
| `title` | text | Título do conteúdo |
| `type` | text | 'social' \| 'newsletter' \| 'blog' |
| `ideal_customer_id` | uuid | FK para `ideal_customers(id)` - vínculo com ICP |
| `content` | text | Corpo do post/e-mail |
| `status` | text | 'rascunho' \| 'agendado' \| 'publicado' |
| `created_at` | timestamptz | Data de criação |
| `user_id` | uuid | Quem criou (de `auth.jwt() ->> 'sub'`) |

### Ideal Customers (ICP)

- O campo `ideal_customer_id` deve ser FK para `ideal_customers(id)`.
- Isso permite que, ao visualizar um post, o sistema saiba quais Pain Points ou Buying Journey aquele conteúdo está atacando.

### Auditoria

- Todo registro deve conter `created_at`.
- O `user_id` deve vir de `auth.jwt() ->> 'sub'` para identificar quem criou a peça de marketing.
