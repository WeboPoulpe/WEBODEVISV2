-- Empreinte de l'adresse IP d'une demande de prospect (limite des envois du formulaire de fin de brochure).
ALTER TABLE "prospect_requests" ADD COLUMN IF NOT EXISTS "ip_hash" text;
