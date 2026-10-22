-- Formules au choix gardées avec un devis enregistré comme modèle (reprises par les devis créés depuis ce modèle).
ALTER TABLE "devis_templates" ADD COLUMN IF NOT EXISTS "formulas" jsonb;