-- RLS baseado em profiles (compatível com Clerk) para kb_files_control
-- A política anterior exigia company_id no JWT; esta usa subquery em profiles.

DROP POLICY IF EXISTS "Users can manage their company files" ON kb_files_control;

CREATE POLICY "Users can view company kb files" ON kb_files_control FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
  )
);

CREATE POLICY "Users can insert company kb files" ON kb_files_control FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
  )
);

CREATE POLICY "Users can update company kb files" ON kb_files_control FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
  )
);

CREATE POLICY "Users can delete company kb files" ON kb_files_control FOR DELETE USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = (auth.jwt() ->> 'sub') AND company_id IS NOT NULL
  )
);
