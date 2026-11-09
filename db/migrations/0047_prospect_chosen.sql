-- Demandes venues d'une brochure : prestations choisies par le lecteur (« Je veux ce menu »). Additive.
ALTER TABLE "prospect_requests" ADD COLUMN IF NOT EXISTS "chosen" jsonb;
