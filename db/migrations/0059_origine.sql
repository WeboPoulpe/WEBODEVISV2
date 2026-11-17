-- Origine Instagram (docs/superpowers/specs/2026-11-17-origine-instagram-design.md) : « instagram » ou
-- « instagram:<libellé> », sur la visite (site_visits), la demande (site_requests) et le compte (profiles).
-- Nouvel événement « clic » : un clic sur un lien webodevis.fr/ig. Rejouable.
ALTER TABLE "public"."site_visits" ADD COLUMN IF NOT EXISTS "origin" text;
--> statement-breakpoint
ALTER TABLE "public"."site_requests" ADD COLUMN IF NOT EXISTS "origin" text;
--> statement-breakpoint
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "origin" text;
--> statement-breakpoint
ALTER TABLE "public"."site_visits" DROP CONSTRAINT IF EXISTS "site_visits_event_check";
--> statement-breakpoint
ALTER TABLE "public"."site_visits" ADD CONSTRAINT "site_visits_event_check" CHECK (event = ANY (ARRAY['view'::text, 'demo'::text, 'contact'::text, 'signup'::text, 'clic'::text]));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_site_visits_origin_day" ON "public"."site_visits" USING btree ("day") WHERE "origin" IS NOT NULL;
