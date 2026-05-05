-- Fonction qui crée une notification stock_alert quand un mouvement OUT
-- amène le stock en dessous du seuil min_stock_alert
CREATE OR REPLACE FUNCTION check_stock_alert() RETURNS TRIGGER AS $$
DECLARE
  ing RECORD;
BEGIN
  SELECT id, name, stock_quantity, min_stock_alert, unit, user_id
    INTO ing FROM ingredients WHERE id = NEW.ingredient_id;

  IF ing.min_stock_alert IS NOT NULL
     AND ing.min_stock_alert > 0
     AND ing.stock_quantity <= ing.min_stock_alert
     AND ing.user_id IS NOT NULL
  THEN
    -- Vérifie qu'on n'a pas déjà une alerte non lue pour cet ingrédient
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = ing.user_id
        AND type = 'stock_alert'
        AND is_read = false
        AND action_url = '/stock?ing=' || ing.id::text
    ) THEN
      INSERT INTO notifications (user_id, title, message, type, priority, action_url)
      VALUES (
        ing.user_id,
        'Stock bas : ' || ing.name,
        'Stock actuel : ' || COALESCE(ing.stock_quantity::text, '0') || COALESCE(ing.unit, '') ||
          ' (seuil : ' || ing.min_stock_alert::text || COALESCE(ing.unit, '') || ')',
        'stock_alert',
        CASE WHEN ing.stock_quantity <= 0 THEN 'high' ELSE 'medium' END,
        '/stock?ing=' || ing.id::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_stock_alert ON stock_movements;
CREATE TRIGGER trg_check_stock_alert
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  WHEN (NEW.movement_type IN ('out', 'adjust'))
  EXECUTE FUNCTION check_stock_alert();

-- Étendre le type CHECK des notifications pour accepter stock_alert (si CHECK existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check') THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'prospect_request', 'upcoming_event', 'invoice_due',
    'support_ticket', 'system_update', 'task_reminder', 'stock_alert'
  ));
