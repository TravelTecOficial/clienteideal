-- Schema inicial: tabelas base para o projeto dev
-- Ordem respeita dependências de FK

-- ENUMs
CREATE TYPE item_type AS ENUM ('product', 'service');
CREATE TYPE opportunity_stage AS ENUM ('novo', 'qualificacao', 'negociacao', 'proposta', 'ganho', 'perdido');

-- COMPANIES (sem dependências)
CREATE TABLE public.companies (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE,
  plan_type text DEFAULT 'free',
  status text DEFAULT 'trialing',
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);

-- PROFILES (depende de companies)
CREATE TABLE public.profiles (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  full_name text,
  company_id text REFERENCES public.companies(id),
  role text DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  phone text,
  job_title text,
  status boolean DEFAULT true
);

-- VENDEDORES
CREATE TABLE public.vendedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  company_id text NOT NULL,
  nome text NOT NULL,
  celular text,
  status boolean DEFAULT true,
  clerk_id text UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- HORARIOS_VENDEDOR
CREATE TABLE public.horarios_vendedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_email text NOT NULL REFERENCES public.vendedores(email),
  company_id text NOT NULL,
  dia_semana integer NOT NULL,
  entrada time,
  saida time,
  "almoço_inicio" time,
  "almoço_fim" time
);

-- IDEAL_CUSTOMERS
CREATE TABLE public.ideal_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  user_id text NOT NULL,
  company_id text NOT NULL,
  profile_name text NOT NULL,
  age_range text,
  gender text,
  location text,
  income_level text,
  job_title text,
  goals_dreams text,
  pain_points text,
  values_list text,
  hobbies_interests text,
  buying_journey text,
  decision_criteria text,
  common_objections text,
  target_product text
);

-- ITEMS
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  company_id text NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  description text,
  price numeric DEFAULT 0.00,
  unit text,
  category text,
  type item_type DEFAULT 'product'
);

-- QUALIFICACOES
CREATE TABLE public.qualificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  company_id text NOT NULL,
  user_id text NOT NULL,
  ideal_customer_id uuid REFERENCES public.ideal_customers(id),
  pergunta text NOT NULL,
  peso integer DEFAULT 1 CHECK (peso BETWEEN 1 AND 3),
  resposta_fria text NOT NULL,
  resposta_morna text NOT NULL,
  resposta_quente text NOT NULL
);

-- LEADS
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  company_id text NOT NULL REFERENCES public.companies(id),
  user_id text NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  external_id text,
  status text DEFAULT 'Novo' CHECK (status IN ('Novo', 'Em Contato', 'Qualificado', 'Perdido')),
  ideal_customer_id uuid REFERENCES public.ideal_customers(id),
  seller_id text
);

-- OPPORTUNITIES
CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  company_id text NOT NULL REFERENCES public.companies(id),
  user_id text,
  title text NOT NULL,
  value numeric DEFAULT 0,
  expected_closing_date date,
  stage opportunity_stage DEFAULT 'novo',
  seller_id text,
  product_id uuid,
  ideal_customer_id uuid REFERENCES public.ideal_customers(id)
);

-- AGENDA (user_id/vendedor_id sem FK - projeto usa Clerk)
CREATE TABLE public.agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  company_id text NOT NULL REFERENCES public.companies(id),
  user_id uuid,
  vendedor_id uuid,
  data_hora timestamptz NOT NULL,
  tipo_reuniao text NOT NULL,
  status text DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Confirmado', 'Cancelado', 'Finalizado')),
  descricao text
);

-- KB_FILES_CONTROL
CREATE TABLE public.kb_files_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  company_id text NOT NULL REFERENCES public.companies(id),
  user_id text,
  file_name text NOT NULL,
  drive_file_id text,
  training_type text NOT NULL,
  description text
);

-- ATENDIMENTOS_IA
CREATE TABLE public.atendimentos_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  company_id text NOT NULL,
  id_vendedor text REFERENCES public.profiles(id),
  id_conversa text,
  score_final integer DEFAULT 0,
  classificacao text,
  nome text,
  celular text NOT NULL,
  email text NOT NULL,
  idade date,
  preferencia text,
  reuniao_date timestamptz,
  lead_results text,
  external_id text,
  estagio text,
  estado text,
  cidade text,
  utm_id text,
  utm_campaing text,
  utm_content text,
  utm_medium text,
  utm_source text,
  gclid text,
  fbclid text,
  historico_json jsonb
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_vendedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideal_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_files_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimentos_ia ENABLE ROW LEVEL SECURITY;

-- Políticas para sync fallback (criação de company/profile em localhost)
CREATE POLICY "Users can insert own company for sync" ON public.companies
  FOR INSERT WITH CHECK (id = 'company-' || replace(coalesce(auth.jwt() ->> 'sub', ''), 'user_', ''));

CREATE POLICY "Users can insert own profile for sync" ON public.profiles
  FOR INSERT WITH CHECK (id = (auth.jwt() ->> 'sub'));
