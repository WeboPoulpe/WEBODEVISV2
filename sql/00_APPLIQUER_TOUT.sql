-- ═══════════════════════════════════════════════════════════════════════════
-- 📌 À APPLIQUER EN UN SEUL COPIER-COLLER dans le SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════════════════════
-- Regroupe, DANS LE BON ORDRE, toutes les migrations en attente :
--   1) fix_admin_rls_recursion.sql   (fonction is_admin + policies admin)
--   2) security_hardening.sql        (anti-escalade role + storage par propriétaire)
--   3) lot_a_fixes.sql               (frais extra_costs + RLS prospect_requests / 403)
--   4) lot_b_fixes.sql               (nb d'enfants prospect)
--
-- Idempotent : peut être relancé sans effet de bord.
-- ⚠️ Fichier GÉNÉRÉ à partir des fichiers sources — pour toute modif, éditer les
--    fichiers d'origine puis régénérer, afin d'éviter la divergence.
-- ═══════════════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- ║ 1) fix_admin_rls_recursion.sql                                          ║
-- └─────────────────────────────────────────────────────────────────────────┘
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(text) CASCADE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- profiles
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- quotes
DROP POLICY IF EXISTS "Admins can view all quotes" ON quotes;
CREATE POLICY "Admins can view all quotes" ON quotes
  FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Admins can update all quotes" ON quotes;
CREATE POLICY "Admins can update all quotes" ON quotes
  FOR UPDATE USING (is_admin());

-- prestation_categories (globales)
DROP POLICY IF EXISTS "Admins can insert global categories" ON prestation_categories;
CREATE POLICY "Admins can insert global categories" ON prestation_categories
  FOR INSERT WITH CHECK (user_id IS NULL AND is_admin());
DROP POLICY IF EXISTS "Admins can update global categories" ON prestation_categories;
CREATE POLICY "Admins can update global categories" ON prestation_categories
  FOR UPDATE USING (user_id IS NULL AND is_admin());
DROP POLICY IF EXISTS "Admins can delete global categories" ON prestation_categories;
CREATE POLICY "Admins can delete global categories" ON prestation_categories
  FOR DELETE USING (user_id IS NULL AND is_admin());

-- prestation_subcategories (globales)
DROP POLICY IF EXISTS "Admins can insert global subcategories" ON prestation_subcategories;
CREATE POLICY "Admins can insert global subcategories" ON prestation_subcategories
  FOR INSERT WITH CHECK (user_id IS NULL AND is_admin());
DROP POLICY IF EXISTS "Admins can update global subcategories" ON prestation_subcategories;
CREATE POLICY "Admins can update global subcategories" ON prestation_subcategories
  FOR UPDATE USING (user_id IS NULL AND is_admin());
DROP POLICY IF EXISTS "Admins can delete global subcategories" ON prestation_subcategories;
CREATE POLICY "Admins can delete global subcategories" ON prestation_subcategories
  FOR DELETE USING (user_id IS NULL AND is_admin());


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- ║ 2) security_hardening.sql                                               ║
-- └─────────────────────────────────────────────────────────────────────────┘
-- Anti-escalade de privilège sur profiles.role / profiles.is_active
CREATE OR REPLACE FUNCTION public.enforce_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin() THEN
      NEW.role := 'user';
      NEW.is_active := COALESCE(NEW.is_active, true);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
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

-- Storage : écritures limitées au propriétaire (préfixe de dossier = uid)
-- (on drop l'ancien ET le nouveau nom de policy → idempotent même après un run partiel)
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Owner can upload" ON storage.objects;
CREATE POLICY "Owner can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'storage' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Public read access" ON storage.objects;
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'storage');

DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Owner can update" ON storage.objects;
CREATE POLICY "Owner can update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'storage' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete" ON storage.objects;
CREATE POLICY "Owner can delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'storage' AND (storage.foldername(name))[1] = auth.uid()::text);
-- ⚠️ Les fichiers déjà uploadés sous les anciens chemins (logos/…, cover-photos/…,
--    imported-devis/…) ne sont plus supprimables via l'app. À nettoyer manuellement.


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- ║ 3) lot_a_fixes.sql                                                      ║
-- └─────────────────────────────────────────────────────────────────────────┘
-- Frais additionnels de la gestion financière (non persistés avant)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS extra_costs JSONB DEFAULT '[]'::jsonb;

-- Statut prospect qui ne se met pas à jour (403) → RLS propriétaire
ALTER TABLE prospect_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can read prospect_requests" ON prospect_requests;
CREATE POLICY "Owner can read prospect_requests" ON prospect_requests
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR user_token IN (SELECT token FROM user_prospect_tokens WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owner can update prospect_requests" ON prospect_requests;
CREATE POLICY "Owner can update prospect_requests" ON prospect_requests
  FOR UPDATE TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR user_token IN (SELECT token FROM user_prospect_tokens WHERE user_id = auth.uid())
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    OR user_token IN (SELECT token FROM user_prospect_tokens WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owner can delete prospect_requests" ON prospect_requests;
CREATE POLICY "Owner can delete prospect_requests" ON prospect_requests
  FOR DELETE TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR user_token IN (SELECT token FROM user_prospect_tokens WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage prospect_requests" ON prospect_requests;
CREATE POLICY "Admins manage prospect_requests" ON prospect_requests
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- ║ 4) lot_b_fixes.sql                                                      ║
-- └─────────────────────────────────────────────────────────────────────────┘
-- Formulaire de prospection : nombre d'enfants
ALTER TABLE prospect_requests ADD COLUMN IF NOT EXISTS guest_count_children INTEGER;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- ║ 5) lot_c_customer_contacts.sql                                          ║
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS customer_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  name          text NOT NULL,
  role          text,
  email         text,
  phone         text,
  notes         text,
  is_primary    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON customer_contacts(customer_id);
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages own customer_contacts" ON customer_contacts;
CREATE POLICY "Owner manages own customer_contacts" ON customer_contacts
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() AND EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_id AND c.owner_user_id = auth.uid()))
  WITH CHECK (owner_user_id = auth.uid() AND EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_id AND c.owner_user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins manage customer_contacts" ON customer_contacts;
CREATE POLICY "Admins manage customer_contacts" ON customer_contacts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_siret            text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_contact_email text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_contact_phone text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_contact_role  text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_contact_id    text;
INSERT INTO customer_contacts (customer_id, owner_user_id, name, email, phone, is_primary)
SELECT c.id, c.owner_user_id, c.contact_person_name, c.contact_person_email, c.contact_person_phone, true
FROM customers c
WHERE c.customer_type = 'entreprise' AND c.contact_person_name IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM customer_contacts cc WHERE cc.customer_id = c.id);


-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ Terminé. Vérification rapide (optionnel) :
-- SELECT proname FROM pg_proc WHERE proname IN ('is_admin','enforce_profile_role');
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='quotes' AND column_name='extra_costs';
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='prospect_requests' AND column_name='guest_count_children';
-- ═══════════════════════════════════════════════════════════════════════════
