-- Aumenta limite do bucket company-assets para suportar avatares gerados por IA (SDXL).
-- Antes: 1 MB (1048576)
-- Depois: 5 MB (5242880)
UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id = 'company-assets';

