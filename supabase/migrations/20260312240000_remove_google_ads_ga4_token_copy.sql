-- Remove linhas ads/mybusiness que foram criadas pela migração 20260312160000
-- com tokens do GA4 (escopo analytics). Esses tokens não têm permissão para
-- Google Ads API (adwords) nem My Business API (business.manage).
-- Empresas afetadas precisarão reconectar Ads e Meu Negócio via OAuth correto.

DELETE FROM public.google_connections gc
WHERE gc.service IN ('ads', 'mybusiness')
  AND EXISTS (
    SELECT 1 FROM public.google_connections ga4
    WHERE ga4.company_id = gc.company_id
      AND ga4.service = 'ga4'
      AND ga4.access_token_encrypted = gc.access_token_encrypted
  );
