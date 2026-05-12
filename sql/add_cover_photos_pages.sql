-- Page de garde config (JSON: template, clientName, address, eventDate, title, subtitle, photoUrl, photoTransform, customLayout)
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS cover_page_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS photos_page_config JSONB DEFAULT NULL;

-- Photo par prestation
ALTER TABLE prestations
  ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT NULL;
