-- Version anglaise des prestations (carte gastronomique stylée)
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS gastro_card_html_en TEXT;
