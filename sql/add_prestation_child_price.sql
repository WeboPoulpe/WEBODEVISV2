-- Tarif enfant optionnel par prestation
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS child_unit_price NUMERIC;
COMMENT ON COLUMN prestations.child_unit_price IS 'Prix unitaire pour les enfants (NULL = même tarif que adultes)';
