-- Catégories de prestations (globales si user_id IS NULL, sinon perso au traiteur)
CREATE TABLE IF NOT EXISTS prestation_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prestation_categories_user ON prestation_categories(user_id);

-- Sous-catégories rattachées à une catégorie
CREATE TABLE IF NOT EXISTS prestation_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES prestation_categories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prestation_subcategories_user ON prestation_subcategories(user_id);
CREATE INDEX IF NOT EXISTS idx_prestation_subcategories_cat ON prestation_subcategories(category_id);

-- RLS: tous voient les globales (user_id IS NULL), chacun voit/édite les siennes
ALTER TABLE prestation_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestation_subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read global or own categories" ON prestation_categories;
CREATE POLICY "Read global or own categories" ON prestation_categories
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Insert own categories" ON prestation_categories;
CREATE POLICY "Insert own categories" ON prestation_categories
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Update own categories" ON prestation_categories;
CREATE POLICY "Update own categories" ON prestation_categories
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Delete own categories" ON prestation_categories;
CREATE POLICY "Delete own categories" ON prestation_categories
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Read global or own subcategories" ON prestation_subcategories;
CREATE POLICY "Read global or own subcategories" ON prestation_subcategories
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Insert own subcategories" ON prestation_subcategories;
CREATE POLICY "Insert own subcategories" ON prestation_subcategories
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Update own subcategories" ON prestation_subcategories;
CREATE POLICY "Update own subcategories" ON prestation_subcategories
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Delete own subcategories" ON prestation_subcategories;
CREATE POLICY "Delete own subcategories" ON prestation_subcategories
  FOR DELETE USING (user_id = auth.uid());

-- Seed des catégories globales de base
INSERT INTO prestation_categories (id, user_id, name, icon, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111101', NULL, 'Cocktail',   'Wine',            1),
  ('11111111-1111-1111-1111-111111111102', NULL, 'Dîner',      'UtensilsCrossed', 2),
  ('11111111-1111-1111-1111-111111111103', NULL, 'Boissons',   'Coffee',          3),
  ('11111111-1111-1111-1111-111111111104', NULL, 'Matériel',   'Wrench',          4),
  ('11111111-1111-1111-1111-111111111105', NULL, 'Personnel',  'Users',           5),
  ('11111111-1111-1111-1111-111111111106', NULL, 'Logistique', 'Truck',           6)
ON CONFLICT (id) DO NOTHING;

-- Seed des sous-catégories globales de base
INSERT INTO prestation_subcategories (category_id, user_id, name, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111101', NULL, 'Vin d''honneur',     1),
  ('11111111-1111-1111-1111-111111111101', NULL, 'Apéritif',           2),
  ('11111111-1111-1111-1111-111111111101', NULL, 'Bouchées salées',    3),
  ('11111111-1111-1111-1111-111111111101', NULL, 'Bouchées sucrées',   4),
  ('11111111-1111-1111-1111-111111111101', NULL, 'Buffet',             5),

  ('11111111-1111-1111-1111-111111111102', NULL, 'Entrée',             1),
  ('11111111-1111-1111-1111-111111111102', NULL, 'Plat principal',     2),
  ('11111111-1111-1111-1111-111111111102', NULL, 'Accompagnement',     3),
  ('11111111-1111-1111-1111-111111111102', NULL, 'Fromage',            4),
  ('11111111-1111-1111-1111-111111111102', NULL, 'Dessert',            5),
  ('11111111-1111-1111-1111-111111111102', NULL, 'Menu complet',       6),

  ('11111111-1111-1111-1111-111111111103', NULL, 'Alcoolisées',        1),
  ('11111111-1111-1111-1111-111111111103', NULL, 'Sans alcool',        2),
  ('11111111-1111-1111-1111-111111111103', NULL, 'Vins',               3),
  ('11111111-1111-1111-1111-111111111103', NULL, 'Champagne',          4),
  ('11111111-1111-1111-1111-111111111103', NULL, 'Café & thé',         5),

  ('11111111-1111-1111-1111-111111111104', NULL, 'Vaisselle',          1),
  ('11111111-1111-1111-1111-111111111104', NULL, 'Mobilier',           2),
  ('11111111-1111-1111-1111-111111111104', NULL, 'Nappage',            3),
  ('11111111-1111-1111-1111-111111111104', NULL, 'Décoration',         4),
  ('11111111-1111-1111-1111-111111111104', NULL, 'Cuisine',            5),

  ('11111111-1111-1111-1111-111111111105', NULL, 'Serveur',            1),
  ('11111111-1111-1111-1111-111111111105', NULL, 'Chef à domicile',    2),
  ('11111111-1111-1111-1111-111111111105', NULL, 'Maître d''hôtel',    3),
  ('11111111-1111-1111-1111-111111111105', NULL, 'Plongeur',           4),
  ('11111111-1111-1111-1111-111111111105', NULL, 'Barman',             5),

  ('11111111-1111-1111-1111-111111111106', NULL, 'Transport',          1),
  ('11111111-1111-1111-1111-111111111106', NULL, 'Livraison',          2),
  ('11111111-1111-1111-1111-111111111106', NULL, 'Installation',       3),
  ('11111111-1111-1111-1111-111111111106', NULL, 'Déménagement',       4)
ON CONFLICT DO NOTHING;
