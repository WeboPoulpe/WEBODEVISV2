-- Permet de marquer un item de location comme "déjà commandé individuellement"
-- → masqué de la page Location globale (déjà géré par le traiteur en direct)
ALTER TABLE rental_items ADD COLUMN IF NOT EXISTS confirmed_individually BOOLEAN DEFAULT false;
ALTER TABLE rental_items ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
