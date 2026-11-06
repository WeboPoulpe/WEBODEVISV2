-- Onglet « Site web » : les demandes de rappel faites depuis l'app (type « service ») arrivent dans site_requests,
-- avec le compte d'où elles viennent et les réponses du questionnaire. Additive et rejouable sans erreur.
ALTER TABLE "site_requests" DROP CONSTRAINT IF EXISTS "site_requests_kind_check";--> statement-breakpoint
ALTER TABLE "site_requests" ADD COLUMN IF NOT EXISTS "user_id" uuid;--> statement-breakpoint
ALTER TABLE "site_requests" ADD COLUMN IF NOT EXISTS "answers" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_site_requests_user" ON "site_requests" USING btree ("user_id") WHERE (user_id IS NOT NULL);--> statement-breakpoint
ALTER TABLE "site_requests" ADD CONSTRAINT "site_requests_kind_check" CHECK (kind = ANY (ARRAY['devis'::text, 'message'::text, 'demo'::text, 'service'::text]));--> statement-breakpoint
-- L'option « Site web Webomax » est standard : les comptes qui ont déjà une liste d'options la reçoivent aussi.
UPDATE "profiles" SET "modules" = "modules" || '["siteweb"]'::jsonb
  WHERE jsonb_typeof("modules") = 'array' AND NOT ("modules" ? 'siteweb');
