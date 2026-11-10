-- Formulaire de contact : statut « suspecte » pour les demandes classées comme spam (lien, envoi trop rapide).
-- Gardées à part dans l'admin, sans email. Rejouable.
ALTER TABLE "site_requests" DROP CONSTRAINT IF EXISTS "site_requests_status_check";
--> statement-breakpoint
ALTER TABLE "site_requests" ADD CONSTRAINT "site_requests_status_check" CHECK (status = ANY (ARRAY['nouvelle'::text, 'en_cours'::text, 'traitee'::text, 'suspecte'::text]));
