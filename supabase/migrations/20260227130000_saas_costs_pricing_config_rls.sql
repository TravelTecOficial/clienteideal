-- RLS para saas_costs e saas_pricing_config: apenas saas_admin pode acessar.
-- profiles.saas_admin é sincronizado pelo clerk-webhook (publicMetadata.role === "admin").

-- SAAS_COSTS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saas_costs') THEN
    ALTER TABLE public.saas_costs ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "saas_admin_select_saas_costs" ON public.saas_costs;
    CREATE POLICY "saas_admin_select_saas_costs" ON public.saas_costs
      FOR SELECT USING (public.is_saas_admin());

    DROP POLICY IF EXISTS "saas_admin_insert_saas_costs" ON public.saas_costs;
    CREATE POLICY "saas_admin_insert_saas_costs" ON public.saas_costs
      FOR INSERT WITH CHECK (public.is_saas_admin());

    DROP POLICY IF EXISTS "saas_admin_update_saas_costs" ON public.saas_costs;
    CREATE POLICY "saas_admin_update_saas_costs" ON public.saas_costs
      FOR UPDATE USING (public.is_saas_admin());

    DROP POLICY IF EXISTS "saas_admin_delete_saas_costs" ON public.saas_costs;
    CREATE POLICY "saas_admin_delete_saas_costs" ON public.saas_costs
      FOR DELETE USING (public.is_saas_admin());
  END IF;
END $$;

-- SAAS_PRICING_CONFIG
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saas_pricing_config') THEN
    ALTER TABLE public.saas_pricing_config ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "saas_admin_select_saas_pricing_config" ON public.saas_pricing_config;
    CREATE POLICY "saas_admin_select_saas_pricing_config" ON public.saas_pricing_config
      FOR SELECT USING (public.is_saas_admin());

    DROP POLICY IF EXISTS "saas_admin_insert_saas_pricing_config" ON public.saas_pricing_config;
    CREATE POLICY "saas_admin_insert_saas_pricing_config" ON public.saas_pricing_config
      FOR INSERT WITH CHECK (public.is_saas_admin());

    DROP POLICY IF EXISTS "saas_admin_update_saas_pricing_config" ON public.saas_pricing_config;
    CREATE POLICY "saas_admin_update_saas_pricing_config" ON public.saas_pricing_config
      FOR UPDATE USING (public.is_saas_admin());

    DROP POLICY IF EXISTS "saas_admin_delete_saas_pricing_config" ON public.saas_pricing_config;
    CREATE POLICY "saas_admin_delete_saas_pricing_config" ON public.saas_pricing_config
      FOR DELETE USING (public.is_saas_admin());
  END IF;
END $$;
