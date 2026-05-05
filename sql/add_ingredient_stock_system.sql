-- ═══════════════════════════════════════════════════════════════════════════
-- Système de stock + commandes ingrédients
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Champs stock + alerte sur ingrédients
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC DEFAULT 0;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS min_stock_alert NUMERIC DEFAULT 0;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS volume_unit_price NUMERIC DEFAULT 0;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS preferred_supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- 2. Quantité par invité sur la liaison prestation_ingredients
-- (Le champ qty_per_person existe déjà — pas besoin de l'ajouter)
-- ALTER TABLE service_ingredients ADD COLUMN IF NOT EXISTS qty_per_person NUMERIC DEFAULT 0;

-- 3. Mouvements de stock (historique in/out)
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjust')),
  quantity NUMERIC NOT NULL,
  reason TEXT,
  event_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  order_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_user ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_event ON stock_movements(event_id);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users CRUD own stock movements" ON stock_movements;
CREATE POLICY "Users CRUD own stock movements" ON stock_movements
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. Bons de commande
CREATE TABLE IF NOT EXISTS supplier_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  event_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'received', 'cancelled')),
  total_amount NUMERIC DEFAULT 0,
  notes TEXT,
  ordered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_orders_user ON supplier_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier ON supplier_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_event ON supplier_orders(event_id);

ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users CRUD own supplier orders" ON supplier_orders;
CREATE POLICY "Users CRUD own supplier orders" ON supplier_orders
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 5. Lignes de commande (un order = plusieurs ingrédients)
CREATE TABLE IF NOT EXISTS supplier_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC DEFAULT 0,
  received_quantity NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_order_items_order ON supplier_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_order_items_ingredient ON supplier_order_items(ingredient_id);

ALTER TABLE supplier_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access order items via order" ON supplier_order_items;
CREATE POLICY "Users access order items via order" ON supplier_order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM supplier_orders o WHERE o.id = supplier_order_items.order_id AND o.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM supplier_orders o WHERE o.id = supplier_order_items.order_id AND o.user_id = auth.uid())
  );

-- 6. Trigger: à chaque mouvement de stock, mettre à jour ingredients.stock_quantity
CREATE OR REPLACE FUNCTION apply_stock_movement() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'in' THEN
    UPDATE ingredients SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity WHERE id = NEW.ingredient_id;
  ELSIF NEW.movement_type = 'out' THEN
    UPDATE ingredients SET stock_quantity = COALESCE(stock_quantity, 0) - NEW.quantity WHERE id = NEW.ingredient_id;
  ELSIF NEW.movement_type = 'adjust' THEN
    UPDATE ingredients SET stock_quantity = NEW.quantity WHERE id = NEW.ingredient_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_stock_movement ON stock_movements;
CREATE TRIGGER trg_apply_stock_movement
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();
