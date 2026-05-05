-- ═══════════════════════════════════════════════════════════════════════════
-- Colonnes manquantes sur quotes
-- À lancer si l'éditeur de devis (modifier) renvoie 400 sur le SELECT initial
-- ═══════════════════════════════════════════════════════════════════════════

-- Adultes / enfants (séparation du guest_count global)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS guest_count_adults INT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS guest_count_children INT;

-- Multilingue FR/EN du devis
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr';
