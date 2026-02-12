-- Tabela agenda para gerenciamento de reuniões (multitenancy via company_id)
CREATE TABLE IF NOT EXISTS public.agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  data_hora timestamptz NOT NULL,
  tipo_reuniao text NOT NULL,
  vendedor_id text REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('Pendente', 'Confirmado', 'Cancelado', 'Finalizado')),
  descricao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: isolamento por company_id via profiles (compatível com Clerk)
ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company agenda" ON agenda
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can insert company agenda" ON agenda
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can update company agenda" ON agenda
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can delete company agenda" ON agenda
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
    )
  );
