-- Annuaire public « Choisir Mon Traiteur » : une fiche par traiteur (directory_listings), ses photos et les brochures
-- qu'il y expose, plus l'origine des demandes de prospects. Additive et rejouable.
CREATE TABLE IF NOT EXISTS "directory_listings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'brouillon' NOT NULL,
	"siret" text,
	"check_result" jsonb,
	"display_name" text NOT NULL,
	"tagline" text,
	"description" text,
	"city" text,
	"postal_code" text,
	"departments" text[] DEFAULT '{}' NOT NULL,
	"event_types" text[] DEFAULT '{}' NOT NULL,
	"website_url" text,
	"guests_min" integer,
	"guests_max" integer,
	"price_from" numeric,
	"cover_photo_id" uuid,
	"refused_reason" text,
	"submitted_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "directory_listings_slug_key" UNIQUE("slug"),
	CONSTRAINT "directory_listings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "profiles"("id") ON DELETE cascade,
	CONSTRAINT "directory_listings_status_check" CHECK (status = ANY (ARRAY['brouillon'::text, 'en_attente'::text, 'publiee'::text, 'refusee'::text, 'suspendue'::text]))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_directory_listings_departments" ON "directory_listings" USING gin ("departments");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_directory_listings_status" ON "directory_listings" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_directory_listings_siret" ON "directory_listings" USING btree ("siret");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "directory_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"url" text NOT NULL,
	"path" text NOT NULL,
	"alt" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "directory_photos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "directory_listings"("company_id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_directory_photos_company" ON "directory_photos" USING btree ("company_id", "position");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "directory_listing_brochures" (
	"company_id" uuid NOT NULL,
	"brochure_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "directory_listing_brochures_pkey" PRIMARY KEY ("company_id", "brochure_id"),
	CONSTRAINT "directory_listing_brochures_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "directory_listings"("company_id") ON DELETE cascade,
	CONSTRAINT "directory_listing_brochures_brochure_id_fkey" FOREIGN KEY ("brochure_id") REFERENCES "brochures"("id") ON DELETE cascade,
	CONSTRAINT "directory_listing_brochures_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "brochure_links"("id") ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE "prospect_requests" ADD COLUMN IF NOT EXISTS "source" text;
