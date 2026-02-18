-- Modelos de persona globais (admin). Usuários copiam para ideal_customers da sua empresa.
CREATE TABLE public.persona_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  profile_name text NOT NULL,
  description text,
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
  target_product text,
  avatar_url text
);

COMMENT ON TABLE public.persona_templates IS 'Modelos de persona criados pelo admin. Licenças copiam para ideal_customers.';

ALTER TABLE public.persona_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: usuários autenticados podem listar templates (para copiar na página Cliente Ideal)
CREATE POLICY "Authenticated users can view persona_templates" ON public.persona_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: apenas via service role (Edge Function admin-persona-templates)
-- Nenhuma policy para usuários; operações de escrita usam service role.
