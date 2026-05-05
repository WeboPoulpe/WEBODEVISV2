-- ═══════════════════════════════════════════════════════════════════════════
-- Espace admin
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Te désigner admin (remplace l'email par le tien)
UPDATE profiles SET role = 'admin' WHERE email = 'maxence.medard10@gmail.com';
-- Vérifie:
-- SELECT id, email, role FROM profiles WHERE role = 'admin';

-- 2. RLS supplémentaires pour permettre aux admins de gérer les catégories globales

-- Permet à l'admin d'INSERT des catégories globales (user_id NULL)
DROP POLICY IF EXISTS "Admins can insert global categories" ON prestation_categories;
CREATE POLICY "Admins can insert global categories" ON prestation_categories
  FOR INSERT WITH CHECK (
    user_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update global categories" ON prestation_categories;
CREATE POLICY "Admins can update global categories" ON prestation_categories
  FOR UPDATE USING (
    user_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete global categories" ON prestation_categories;
CREATE POLICY "Admins can delete global categories" ON prestation_categories
  FOR DELETE USING (
    user_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert global subcategories" ON prestation_subcategories;
CREATE POLICY "Admins can insert global subcategories" ON prestation_subcategories
  FOR INSERT WITH CHECK (
    user_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update global subcategories" ON prestation_subcategories;
CREATE POLICY "Admins can update global subcategories" ON prestation_subcategories
  FOR UPDATE USING (
    user_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete global subcategories" ON prestation_subcategories;
CREATE POLICY "Admins can delete global subcategories" ON prestation_subcategories
  FOR DELETE USING (
    user_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Permettre aux admins de SELECT toutes les profiles (pour la page Users)
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 4. Permettre aux admins d'UPDATE toutes les profiles (désactiver/promouvoir)
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
