-- Langue du devis (fr ou en) pour utiliser la bonne version des prestations
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr';
