-- ═══════════════════════════════════════════════════════════════════════════
-- Fix récursion infinie RLS sur les policies admin
-- ═══════════════════════════════════════════════════════════════════════════
-- Problème : `EXISTS (SELECT 1 FROM profiles WHERE ... role = 'admin')`
-- déclenche la policy SELECT de profiles → qui contient le même EXISTS →
-- récursion infinie → 500/400 sur toute requête (quotes, profiles, etc.)
--
-- Solution : fonction SECURITY DEFINER `is_admin()` qui bypasse RLS pour le
-- check, et toutes les policies admin la réutilisent.
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop toutes les signatures existantes (évite "function is_admin() is not unique")
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

-- ── profiles ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- ── quotes ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all quotes" ON quotes;
CREATE POLICY "Admins can view all quotes" ON quotes
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all quotes" ON quotes;
CREATE POLICY "Admins can update all quotes" ON quotes
  FOR UPDATE USING (is_admin());

-- ── prestation_categories (globales) ────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert global categories" ON prestation_categories;
CREATE POLICY "Admins can insert global categories" ON prestation_categories
  FOR INSERT WITH CHECK (user_id IS NULL AND is_admin());

DROP POLICY IF EXISTS "Admins can update global categories" ON prestation_categories;
CREATE POLICY "Admins can update global categories" ON prestation_categories
  FOR UPDATE USING (user_id IS NULL AND is_admin());

DROP POLICY IF EXISTS "Admins can delete global categories" ON prestation_categories;
CREATE POLICY "Admins can delete global categories" ON prestation_categories
  FOR DELETE USING (user_id IS NULL AND is_admin());

-- ── prestation_subcategories (globales) ─────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert global subcategories" ON prestation_subcategories;
CREATE POLICY "Admins can insert global subcategories" ON prestation_subcategories
  FOR INSERT WITH CHECK (user_id IS NULL AND is_admin());

DROP POLICY IF EXISTS "Admins can update global subcategories" ON prestation_subcategories;
CREATE POLICY "Admins can update global subcategories" ON prestation_subcategories
  FOR UPDATE USING (user_id IS NULL AND is_admin());

DROP POLICY IF EXISTS "Admins can delete global subcategories" ON prestation_subcategories;
CREATE POLICY "Admins can delete global subcategories" ON prestation_subcategories
  FOR DELETE USING (user_id IS NULL AND is_admin());
