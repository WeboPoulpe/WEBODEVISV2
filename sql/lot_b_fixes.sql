-- ═══════════════════════════════════════════════════════════════════════════
-- Correctifs Lot B — à lancer dans le SQL Editor de Supabase (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════

-- Formulaire de prospection : nombre d'enfants
ALTER TABLE prospect_requests ADD COLUMN IF NOT EXISTS guest_count_children INTEGER;
