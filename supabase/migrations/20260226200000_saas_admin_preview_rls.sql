-- Permite que admins do SaaS (profiles.saas_admin = true) visualizem dados
-- de qualquer empresa no modo preview. O frontend filtra por company_id
-- via sessionStorage; RLS apenas autoriza o acesso.
-- profiles.saas_admin é sincronizado pelo clerk-webhook (publicMetadata.role === "admin").

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saas_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.saas_admin IS 'Admin do SaaS (Clerk publicMetadata.role === "admin"). Pode visualizar dados de qualquer empresa no preview.';

-- Helper: usuário é saas_admin
CREATE OR REPLACE FUNCTION public.is_saas_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT saas_admin FROM profiles WHERE id = (auth.jwt() ->> 'sub')),
    false
  );
$$;

-- LEADS
DROP POLICY IF EXISTS "Users can view company leads" ON leads;
CREATE POLICY "Users can view company leads" ON leads
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can update company leads" ON leads;
CREATE POLICY "Users can update company leads" ON leads
  FOR UPDATE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- IDEAL_CUSTOMERS
DROP POLICY IF EXISTS "Users can view their company ideal_customers" ON ideal_customers;
CREATE POLICY "Users can view their company ideal_customers" ON ideal_customers
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can update company ideal_customers" ON ideal_customers;
CREATE POLICY "Users can update company ideal_customers" ON ideal_customers
  FOR UPDATE USING (
    public.is_saas_admin()
    OR (auth.jwt() ->> 'sub') = user_id
  );

-- OPPORTUNITIES
DROP POLICY IF EXISTS "Users can view company opportunities" ON opportunities;
CREATE POLICY "Users can view company opportunities" ON opportunities
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can update company opportunities" ON opportunities;
CREATE POLICY "Users can update company opportunities" ON opportunities
  FOR UPDATE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- ITEMS
DROP POLICY IF EXISTS "Users can view their company items" ON items;
CREATE POLICY "Users can view their company items" ON items
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- COMPANIES (admin precisa ler qualquer company para o preview)
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
CREATE POLICY "Users can view their own company" ON companies
  FOR SELECT USING (
    public.is_saas_admin()
    OR id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- VENDEDORES
DROP POLICY IF EXISTS "Users can view company vendedores" ON vendedores;
CREATE POLICY "Users can view company vendedores" ON vendedores
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- AGENDA
DROP POLICY IF EXISTS "Users can view company agenda" ON agenda;
CREATE POLICY "Users can view company agenda" ON agenda
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- ATENDIMENTOS_IA
DROP POLICY IF EXISTS "Empresas visualizam apenas seus próprios atendimentos" ON atendimentos_ia;
CREATE POLICY "Empresas visualizam apenas seus próprios atendimentos" ON atendimentos_ia
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- QUALIFICADORES
DROP POLICY IF EXISTS "Visualização por company_id" ON qualificadores;
CREATE POLICY "Visualização por company_id" ON qualificadores
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Atualização por company_id" ON qualificadores;
CREATE POLICY "Atualização por company_id" ON qualificadores
  FOR UPDATE USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- QUALIFICACAO_PERGUNTAS
DROP POLICY IF EXISTS "Visualização qualificacao_perguntas" ON qualificacao_perguntas;
CREATE POLICY "Visualização qualificacao_perguntas" ON qualificacao_perguntas
  FOR SELECT USING (
    public.is_saas_admin()
    OR EXISTS (
      SELECT 1 FROM qualificadores q
      WHERE q.id = qualificacao_perguntas.qualificador_id
      AND q.company_id IN (
        SELECT company_id FROM profiles
        WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
      )
    )
  );

-- QUALIFICACAO_RESPOSTAS (via qualificadores)
DROP POLICY IF EXISTS "Visualização qualificacao_respostas" ON qualificacao_respostas;
CREATE POLICY "Visualização qualificacao_respostas" ON qualificacao_respostas
  FOR SELECT USING (
    public.is_saas_admin()
    OR EXISTS (
      SELECT 1 FROM qualificacao_perguntas qp
      JOIN qualificadores q ON q.id = qp.qualificador_id
      WHERE qp.id = qualificacao_respostas.pergunta_id
      AND q.company_id IN (
        SELECT company_id FROM profiles
        WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
      )
    )
  );

-- PAGAMENTOS_ANUNCIOS
DROP POLICY IF EXISTS "Users can view company pagamentos_anuncios" ON pagamentos_anuncios;
CREATE POLICY "Users can view company pagamentos_anuncios" ON pagamentos_anuncios
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- PROMPT_ATENDIMENTO
DROP POLICY IF EXISTS "Users can view their company prompt_atendimento" ON prompt_atendimento;
CREATE POLICY "Users can view their company prompt_atendimento" ON prompt_atendimento
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- KB_FILES_CONTROL
DROP POLICY IF EXISTS "Users can view company kb files" ON kb_files_control;
CREATE POLICY "Users can view company kb files" ON kb_files_control
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- CAMPANHAS_ANUNCIOS
DROP POLICY IF EXISTS "Users can view company campanhas_anuncios" ON campanhas_anuncios;
CREATE POLICY "Users can view company campanhas_anuncios" ON campanhas_anuncios
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- CONFIG_QUALIFICACAO
DROP POLICY IF EXISTS "config_qualificacao_select_company" ON config_qualificacao;
CREATE POLICY "config_qualificacao_select_company" ON config_qualificacao
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- LEADS_SESSAO
DROP POLICY IF EXISTS "leads_sessao_select_company" ON leads_sessao;
CREATE POLICY "leads_sessao_select_company" ON leads_sessao
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

-- COMPANY_BRIEFING_RESPONSES
DROP POLICY IF EXISTS "Users can view own company briefing responses" ON company_briefing_responses;
CREATE POLICY "Users can view own company briefing responses" ON company_briefing_responses
  FOR SELECT USING (
    public.is_saas_admin()
    OR company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );
