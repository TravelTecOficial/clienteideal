-- RLS para cotas_imoveis e cotas_veiculos: permite saas_admin visualizar/editar
-- dados de qualquer empresa no modo preview. Usuários normais veem apenas sua empresa.
-- Nota: Se as tabelas não existirem, esta migração falhará. Crie-as antes se necessário.

-- COTAS_IMOVEIS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cotas_imoveis') THEN
    ALTER TABLE public.cotas_imoveis ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view company cotas_imoveis" ON public.cotas_imoveis;
    CREATE POLICY "Users can view company cotas_imoveis" ON public.cotas_imoveis
      FOR SELECT USING (
        public.is_saas_admin()
        OR company_id IN (
          SELECT company_id FROM profiles
          WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
        )
      );

    DROP POLICY IF EXISTS "Users can insert company cotas_imoveis" ON public.cotas_imoveis;
    CREATE POLICY "Users can insert company cotas_imoveis" ON public.cotas_imoveis
      FOR INSERT WITH CHECK (
        public.is_saas_admin()
        OR company_id IN (
          SELECT company_id FROM profiles
          WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
        )
      );

    DROP POLICY IF EXISTS "Users can update company cotas_imoveis" ON public.cotas_imoveis;
    CREATE POLICY "Users can update company cotas_imoveis" ON public.cotas_imoveis
      FOR UPDATE USING (
        public.is_saas_admin()
        OR company_id IN (
          SELECT company_id FROM profiles
          WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
        )
      );

    DROP POLICY IF EXISTS "Users can delete company cotas_imoveis" ON public.cotas_imoveis;
    CREATE POLICY "Users can delete company cotas_imoveis" ON public.cotas_imoveis
      FOR DELETE USING (
        public.is_saas_admin()
        OR company_id IN (
          SELECT company_id FROM profiles
          WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
        )
      );
  END IF;
END $$;

-- COTAS_VEICULOS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cotas_veiculos') THEN
    ALTER TABLE public.cotas_veiculos ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view company cotas_veiculos" ON public.cotas_veiculos;
    CREATE POLICY "Users can view company cotas_veiculos" ON public.cotas_veiculos
      FOR SELECT USING (
        public.is_saas_admin()
        OR company_id IN (
          SELECT company_id FROM profiles
          WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
        )
      );

    DROP POLICY IF EXISTS "Users can insert company cotas_veiculos" ON public.cotas_veiculos;
    CREATE POLICY "Users can insert company cotas_veiculos" ON public.cotas_veiculos
      FOR INSERT WITH CHECK (
        public.is_saas_admin()
        OR company_id IN (
          SELECT company_id FROM profiles
          WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
        )
      );

    DROP POLICY IF EXISTS "Users can update company cotas_veiculos" ON public.cotas_veiculos;
    CREATE POLICY "Users can update company cotas_veiculos" ON public.cotas_veiculos
      FOR UPDATE USING (
        public.is_saas_admin()
        OR company_id IN (
          SELECT company_id FROM profiles
          WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
        )
      );

    DROP POLICY IF EXISTS "Users can delete company cotas_veiculos" ON public.cotas_veiculos;
    CREATE POLICY "Users can delete company cotas_veiculos" ON public.cotas_veiculos
      FOR DELETE USING (
        public.is_saas_admin()
        OR company_id IN (
          SELECT company_id FROM profiles
          WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
        )
      );
  END IF;
END $$;
