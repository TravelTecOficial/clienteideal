-- Bucket para imagens de empresas (ex: logo para grupos WhatsApp)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-assets',
  'company-assets',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Política: usuários autenticados podem fazer upload para a pasta da sua company
CREATE POLICY "company_assets_upload_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id FROM public.profiles WHERE id = auth.jwt() ->> 'sub'
    )
  );

-- Política: leitura pública para URLs (imagens em grupos WhatsApp)
CREATE POLICY "company_assets_select_public"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'company-assets');

-- Política: usuários podem atualizar/deletar arquivos da sua company
CREATE POLICY "company_assets_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id FROM public.profiles WHERE id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "company_assets_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id FROM public.profiles WHERE id = auth.jwt() ->> 'sub'
    )
  );
