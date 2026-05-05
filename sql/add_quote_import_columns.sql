-- ═══════════════════════════════════════════════════════════════════════════
-- Colonnes pour la fonctionnalité "Import devis" (référencées par devis/page.tsx)
-- À lancer si la page Devis renvoie 400 "column 'imported' does not exist"
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS imported BOOLEAN DEFAULT false;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS imported_file_url TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS imported_file_name TEXT;
