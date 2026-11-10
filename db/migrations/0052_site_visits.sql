-- Statistiques du site de présentation, sans cookie (lib/siteStats.ts) : une ligne par page vue ou par conversion
-- (démo ouverte, demande de contact, compte créé). Aucune adresse IP : `visitor` est une empreinte valable un seul
-- jour. Effacées après 13 mois. Additive et rejouable.
CREATE TABLE IF NOT EXISTS "site_visits" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"day" date NOT NULL,
	"path" text NOT NULL,
	"event" text DEFAULT 'view' NOT NULL,
	"source" text DEFAULT 'direct' NOT NULL,
	"referrer_host" text,
	"device" text DEFAULT 'ordinateur' NOT NULL,
	"visitor" text NOT NULL,
	CONSTRAINT "site_visits_event_check" CHECK (event = ANY (ARRAY['view'::text, 'demo'::text, 'contact'::text, 'signup'::text])),
	CONSTRAINT "site_visits_source_check" CHECK (source = ANY (ARRAY['direct'::text, 'recherche'::text, 'reseaux'::text, 'site'::text])),
	CONSTRAINT "site_visits_device_check" CHECK (device = ANY (ARRAY['mobile'::text, 'tablette'::text, 'ordinateur'::text]))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_site_visits_day" ON "site_visits" USING btree ("day");
