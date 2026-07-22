-- ═══════════════════════════════════════════════════════════════════════════
-- Durcissement sécurité — à lancer dans le SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════════════════════
-- Idempotent : peut être relancé sans effet de bord.
-- Pré-requis : la fonction public.is_admin() doit exister
--   (cf. sql/fix_admin_rls_recursion.sql — à lancer AVANT ce fichier).
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) ANTI-ESCALADE DE PRIVILÈGE sur profiles.role / profiles.is_active
-- ─────────────────────────────────────────────────────────────────────────────
-- Problème : le client (clé anon) peut faire
--   supabase.from('profiles').upsert({ id, role: 'admin' })
-- sur SA PROPRE ligne → devient admin → lit/écrit les données de tous les tenants.
--
-- Solution : un trigger BEFORE INSERT/UPDATE force role='user' et is_active
--   par défaut, SAUF si l'appelant est déjà admin (is_admin()). Les colonnes
--   sensibles ne peuvent donc plus être pilotées depuis le navigateur.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Un non-admin ne peut créer que le rôle 'user'.
    IF NOT public.is_admin() THEN
      NEW.role := 'user';
      -- Laisser l'app activer le compte, mais empêcher l'auto-attribution de droits.
      NEW.is_active := COALESCE(NEW.is_active, true);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Un non-admin ne peut PAS changer role ni is_active (on restaure l'ancienne valeur).
    IF NOT public.is_admin() THEN
      NEW.role := OLD.role;
      NEW.is_active := OLD.is_active;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_role ON public.profiles;
CREATE TRIGGER trg_enforce_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_role();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) STORAGE : écritures limitées au propriétaire (préfixe de dossier = uid)
-- ─────────────────────────────────────────────────────────────────────────────
-- Problème : les policies UPDATE/DELETE ne vérifiaient que bucket_id='storage'
--   → tout utilisateur authentifié pouvait écraser/supprimer les fichiers des autres.
--
-- Convention de chemin (mise en place côté app) : `{auth.uid()}/...`
--   → le 1er segment du path est l'uid du propriétaire.
-- La lecture reste publique (liens de partage), mais INSERT/UPDATE/DELETE sont
-- restreints au dossier du propriétaire.
-- ─────────────────────────────────────────────────────────────────────────────

-- INSERT : uniquement dans son propre dossier
-- (on drop l'ancien ET le nouveau nom → idempotent même après un run partiel)
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Owner can upload" ON storage.objects;
CREATE POLICY "Owner can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'storage'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT : lecture publique conservée (liens partageables)
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'storage');

-- UPDATE : seulement ses propres fichiers
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Owner can update" ON storage.objects;
CREATE POLICY "Owner can update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'storage'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE : seulement ses propres fichiers
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete" ON storage.objects;
CREATE POLICY "Owner can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'storage'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ⚠️ NOTE : les fichiers déjà uploadés AVANT ce changement (anciens chemins
-- `logos/…`, `cover-photos/…`, `imported-devis/…`) ne sont plus supprimables par
-- leur propriétaire via l'app. À migrer ou nettoyer manuellement si besoin.
