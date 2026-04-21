-- Ajout de sous-catégorie aux prestations
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS sub_category TEXT;

-- Ajout cost_price (prix de revient) pour prestations
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;

-- Ajout gastro_card_html pour la styling WeboWord par prestation
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS gastro_card_html TEXT;
