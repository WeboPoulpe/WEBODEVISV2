-- ═══════════════════════════════════════════════════════════════════════════
-- SCRIPT TOUT-EN-UN — Synchronise la base avec le code
-- ═══════════════════════════════════════════════════════════════════════════
-- À lancer dans Supabase SQL Editor une seule fois.
-- Toutes les opérations utilisent IF NOT EXISTS / IF EXISTS donc 100% idempotent.
-- Tu peux le relancer plusieurs fois sans casser quoi que ce soit.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Colonnes manquantes sur quotes ──────────────────────────────────────
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS imported BOOLEAN DEFAULT false;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS imported_file_url TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS imported_file_name TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS guest_count_adults INT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS guest_count_children INT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr';

-- ── 2) Colonnes manquantes sur prestations ─────────────────────────────────
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS child_unit_price NUMERIC;
COMMENT ON COLUMN prestations.child_unit_price IS 'Prix unitaire pour les enfants (NULL = même tarif que adultes)';

-- (Si tes scripts plus anciens définissent déjà cost_price / gastro_card_html_en /
--  is_option / preferred_supplier_id, ils sont idempotents — on les rajoute ici
--  par sécurité au cas où ils n'auraient jamais été lancés)
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS cost_price NUMERIC;
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS is_option BOOLEAN DEFAULT false;
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS gastro_card_html TEXT;
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS gastro_card_html_en TEXT;

-- ── 3) Vérification finale (te montre les colonnes des 2 tables) ───────────
SELECT 'quotes' AS table_name, column_name, data_type
FROM information_schema.columns WHERE table_name = 'quotes'
UNION ALL
SELECT 'prestations' AS table_name, column_name, data_type
FROM information_schema.columns WHERE table_name = 'prestations'
ORDER BY table_name, column_name;
