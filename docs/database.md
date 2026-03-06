# Banco de Dados — Cliente Ideal Online

Este documento resume o modelo de dados no Supabase, as principais tabelas e as migrations mais relevantes, incluindo as novas integrações (Meta/Instagram, WhatsApp e Social Hub).

---

## Visão geral

- Banco de dados **PostgreSQL** gerenciado pelo **Supabase**.
- Isolamento por empresa garantido por **Row Level Security (RLS)**.
- Tabelas de negócio seguem o padrão:
  - Coluna `company_id` obrigatória para dados multi-empresa.
  - Restrições de integridade via chaves estrangeiras (por exemplo, `profiles.company_id -> companies.id`).
- O schema é versionado via arquivos em `supabase/migrations/*.sql`.

---

## Entidades principais

### Usuários e empresas

- `profiles`
  - Representa o usuário autenticado (mapeado para `id` do Clerk).
  - Colunas principais:
    - `id` (PK, texto – Clerk user ID).
    - `company_id` (FK → `companies.id`).
    - `role` (ex.: `admin`, `vendedor`).
    - Metadados adicionais (nome, e-mail, etc.).
- `companies`
  - Representa a empresa (tenant) no SaaS.
  - Colunas principais:
    - `id` (PK).
    - `name`, `slug`.
    - `plan_type` (ex.: `free`, `pro`, `enterprise`).
    - `status`, `segment_type`.
    - `support_access_enabled` (controle de preview pelo Admin SaaS).

### Cliente Ideal e Qualificação

- `ideal_customers`
  - Perfis de cliente ideal (ICP) por empresa.
  - Campos de persona (perfil demográfico, dores, objetivos, etc.).
  - Pode ter vínculo com `prompt_atendimento_id` (prompt IA).
- `qualificadores`
  - Coleções de perguntas usadas para qualificar leads.
  - Vinculados a empresa e, opcionalmente, a um prompt de atendimento.
- `qualificacao_perguntas`
  - Perguntas de cada qualificador (texto, peso, ordem).
- `qualificacao_respostas`
  - Respostas possíveis por pergunta, com classificação (fria, morna, quente).

### Leads, oportunidades e agenda

- `leads`
  - Leads comerciais vinculados a `company_id`, `ideal_customer_id` e, opcionalmente, vendedor.
  - Campos principais:
    - Dados de contato (nome, e-mail, telefone).
    - Status (novo, em contato, qualificado, perdido).
    - `external_id` para integrações.
    - Campo **`conversao`** (texto livre) para registrar o que o cliente comprou.
- `opportunities`
  - Oportunidades de venda em pipeline.
  - Campos: título, valor, estágio, previsão, vendedor, persona, etc.
- `agenda`
  - Reuniões e compromissos.
  - Campos: data/hora, tipo de reunião, vendedor, status.

### Atendimentos e base de conhecimento

- `atendimentos_ia`
  - Histórico de atendimentos e conversas de IA.
  - Campos: score final, classificação, dados de contato, UTM, payload JSON.
- `kb_files_control`
  - Arquivos da base de conhecimento (documentos usados no chat).
  - Campos: `training_type`, `file_name`, `drive_file_id`, etc.

### Produtos, vendedores e horários

- `items`
  - Produtos e serviços cadastrados pela empresa.
  - Campos: `type` (`product` ou `service`), nome, descrição, preço, unidade, categoria.
- `vendedores`
  - Vendedores associados à empresa.
  - Campos: dados de contato, `clerk_id`, vínculo com `profiles`/Clerk via convites.
- `horarios`
  - Horários de trabalho dos vendedores.
  - Campos: dia da semana, horário de entrada/saída, intervalo de almoço.

### Admin SaaS e configuração global

- `admin_evolution_config`
  - Configuração global da Evolution API (URL, API Key).
- `admin_webhook_config`
  - Webhooks do n8n por segmento:
    - `webhook_producao`, `webhook_teste`, `webhook_enviar_arquivos`.
- `admin_gtm_config`
  - Configuração de Google Tag Manager.
- `briefing_questions`
  - Perguntas do questionário de Briefing Estratégico (gerenciado pelo Admin SaaS).
- `company_briefing_responses`
  - Respostas das empresas ao questionário de briefing.

### Social Hub e integrações sociais

- `meta_instagram_integrations`
  - Integração Meta/Instagram por empresa.
  - Campos (principais):
    - `company_id`.
    - `facebook_user_id`, `facebook_user_name`.
    - `scopes` (array de permissões concedidas).
    - `access_token_encrypted` (access token criptografado com AES-GCM).
    - `token_expires_at`.
    - Seleção ativa:
      - `selected_page_id`, `selected_page_name`.
      - `selected_instagram_id`, `selected_instagram_username`.
      - `selected_ad_account_id` (quando usado para Ads).
- `gmb_accounts`
  - Mapeia contas Google My Business (Late Account ID) para empresas.
  - Campos:
    - `company_id`.
    - `late_account_id` (ID da conta na Late API).

### Integrações em geral

- `integrations`
  - Integrações genéricas por usuário (por exemplo, nova integração WhatsApp Cloud API).
  - Usada por `whatsapp-integration`:
    - Campos relevantes:
      - `user_id`.
      - `provider` (ex.: `"whatsapp"`).
      - `access_token`.
      - `waba_id`.
      - `phone_number_id`.
      - `expires_at`.

---

## RLS (Row Level Security)

As políticas de RLS seguem o padrão:

```sql
company_id IN (
  SELECT company_id
  FROM profiles
  WHERE id = (auth.jwt() ->> 'sub')
    AND company_id IS NOT NULL
);
```

Pontos importantes:

- O JWT usado nas consultas vem do **Clerk**, configurado com template `supabase`.
- O frontend nunca manipula diretamente `company_id`; ele é inferido a partir do usuário autenticado.
- Tabelas de configuração global (como `admin_evolution_config`) têm políticas especiais restritas ao Admin SaaS, tipicamente baseadas em metadata de perfil ou checagens nas Edge Functions.

---

## Migrations relevantes

### 1. Leads — campo de conversão

Arquivo: `supabase/migrations/20260227120000_leads_conversao.sql`

```sql
-- Coluna conversao: texto livre para anotar o que o cliente comprou (qualquer segmento)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS conversao text;
COMMENT ON COLUMN public.leads.conversao IS 'O que o cliente comprou ou serviço contratado (texto livre, qualquer segmento).';
```

- Adiciona o campo `conversao` em `leads` para registrar, em texto livre, o que foi efetivamente vendido.
- Não impacta RLS; segue as políticas já definidas em `leads`.

### 2. Meta / Instagram — integrações

Arquivo: `supabase/migrations/20260303110000_meta_instagram_integrations.sql`

- Cria a tabela `meta_instagram_integrations` usada pela função `meta-instagram`.
- Campos principais (resumo):
  - `id` (PK).
  - `company_id` (FK → `companies.id`).
  - `facebook_user_id`, `facebook_user_name`.
  - `scopes` (array de texto).
  - `access_token_encrypted`.
  - `token_expires_at`.
  - `selected_page_id`, `selected_page_name`.
  - `selected_instagram_id`, `selected_instagram_username`, `selected_ad_account_id`.
- Utilizada para:
  - Guardar o token de acesso de forma criptografada.
  - Lembrar qual página/conta Instagram está ativa para métricas.

### 3. Meta / Instagram — seleção de contas

Arquivo: `supabase/migrations/20260304120000_meta_instagram_selection.sql`

- Ajusta/expande a estrutura de `meta_instagram_integrations` para:
  - suportar múltiplas páginas/contas.
  - armazenar o par ativo **Página + Instagram** selecionado na UI.
- Impacto direto na UX:
  - Permite que o módulo de **Indicadores**/Social Hub saiba qual conta deve ser usada para gráficos.

### 4. Integração WhatsApp (Cloud API)

Arquivo: `supabase/migrations/20260305130000_integrations_whatsapp.sql`

- Cria/ajusta a tabela `integrations` para suportar provedor `"whatsapp"`:
  - Campos esperados pela função `whatsapp-integration`:
    - `user_id`, `provider`.
    - `access_token`.
    - `waba_id`.
    - `phone_number_id`.
    - `expires_at`.
- Permite:
  - Conectar uma conta WhatsApp Business (WABA) a um usuário/empresa.
  - Listar e selecionar o número que será usado como **SDR**.

---

## Relações de alto nível

```text
profiles (id TEXT PK, company_id, role, ...)
  └── company_id → companies.id

companies (id PK, name, plan_type, segment_type, support_access_enabled, ...)

ideal_customers (id PK, company_id, ...)
qualificadores (id PK, company_id, ...)
  └── qualificacao_perguntas (qualificador_id → qualificadores.id)
        └── qualificacao_respostas (pergunta_id → qualificacao_perguntas.id)

leads (id PK, company_id, ideal_customer_id, seller_id, status, conversao, ...)
opportunities (id PK, company_id, ...)
agenda (id PK, company_id, ...)
atendimentos_ia (id PK, company_id, ...)
kb_files_control (id PK, company_id, ...)
items (id PK, company_id, ...)
vendedores (id PK, company_id, clerk_id, ...)
horarios (id PK, vendedor_id → vendedores.id)

meta_instagram_integrations (id PK, company_id → companies.id, ...)
gmb_accounts (id PK, company_id → companies.id, late_account_id, ...)
integrations (id PK, user_id → profiles.id, provider, ...)
```

---

## Recomendações para evoluir o schema

- **Manter migrations atômicas**:
  - Cada arquivo `.sql` deve focar em um conjunto pequeno de mudanças coesas.
- **Atualizar RLS em conjunto com novas tabelas**:
  - Sempre criar políticas de RLS junto com a tabela para evitar janelas sem proteção.
- **Evitar campos "genéricos" demais**:
  - Prefira colunas específicas (ex.: `plan_type`, `segment_type`) a JSON livre, a menos que haja forte justificativa.
- **Tipagem no frontend**:
  - Sempre refletir as mudanças de schema em tipos TypeScript, para evitar vazamento de campos sensíveis em respostas API.

Para uma explicação narrativa de como essas tabelas se relacionam com os módulos do sistema, veja também a seção de **Modelo de Dados** em `docs/DOCUMENTACAO_SISTEMA_V1.md`.

