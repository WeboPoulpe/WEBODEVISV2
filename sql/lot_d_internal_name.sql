-- ═══════════════════════════════════════════════════════════════════════════
-- Lot D — Nom interne du devis (à lancer dans le SQL Editor de Supabase, idempotent)
-- ═══════════════════════════════════════════════════════════════════════════
-- Visible uniquement par le traiteur (jamais sur le document client).
-- Fallback d'affichage = client_name quand la valeur est vide.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS internal_name text;
