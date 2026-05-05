-- ═══════════════════════════════════════════════════════════════════════════
-- Politiques RLS pour le bucket "storage" (Supabase Storage)
-- ═══════════════════════════════════════════════════════════════════════════
-- Pré-requis : créer manuellement le bucket "storage" dans Supabase Dashboard
-- (Storage → New bucket → name = "storage", Public bucket = ON)
-- ═══════════════════════════════════════════════════════════════════════════

-- Permet aux users authentifiés d'uploader dans le bucket
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'storage');

-- Lecture publique (les liens vers les PDF/images uploadés sont partageables)
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'storage');

-- Mise à jour (remplacer un fichier)
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'storage');

-- Suppression
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'storage');
