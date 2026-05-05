-- Add ID columns alongside the existing string columns (rétrocompatible)
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES prestation_categories(id) ON DELETE SET NULL;
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS sub_category_id UUID REFERENCES prestation_subcategories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prestations_category_id ON prestations(category_id);
CREATE INDEX IF NOT EXISTS idx_prestations_sub_category_id ON prestations(sub_category_id);

-- Auto-mapping des anciennes valeurs string vers les IDs des catégories globales
UPDATE prestations p SET category_id = c.id
FROM prestation_categories c
WHERE p.category_id IS NULL
  AND c.user_id IS NULL
  AND LOWER(c.name) = LOWER(p.category);

UPDATE prestations p SET sub_category_id = s.id
FROM prestation_subcategories s
WHERE p.sub_category_id IS NULL
  AND s.user_id IS NULL
  AND LOWER(s.name) = LOWER(p.sub_category);
