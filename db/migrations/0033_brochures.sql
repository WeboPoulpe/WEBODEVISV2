-- Brochures : catalogue de prestations feuilletable envoyé par lien, et brochure d'origine des demandes de prospects.
CREATE TABLE IF NOT EXISTS "brochures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"style" text DEFAULT 'editorial' NOT NULL,
	"language" text DEFAULT 'fr' NOT NULL,
	"show_prices" boolean DEFAULT true NOT NULL,
	"price_mode" text DEFAULT 'ttc' NOT NULL,
	"vat_rate" numeric DEFAULT '20' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"share_token" text NOT NULL,
	"cover" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brochures_share_token_key" UNIQUE("share_token"),
	CONSTRAINT "brochures_style_check" CHECK (style = ANY (ARRAY['editorial'::text, 'carte'::text, 'magazine'::text])),
	CONSTRAINT "brochures_language_check" CHECK (language = ANY (ARRAY['fr'::text, 'en'::text])),
	CONSTRAINT "brochures_price_mode_check" CHECK (price_mode = ANY (ARRAY['ht'::text, 'ttc'::text]))
);
--> statement-breakpoint
ALTER TABLE "prospect_requests" ADD COLUMN IF NOT EXISTS "brochure_id" uuid;--> statement-breakpoint
ALTER TABLE "brochures" ADD CONSTRAINT "brochures_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brochures" ADD CONSTRAINT "brochures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_brochures_owner" ON "brochures" USING btree ("owner_user_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "prospect_requests" ADD CONSTRAINT "prospect_requests_brochure_id_fkey" FOREIGN KEY ("brochure_id") REFERENCES "public"."brochures"("id") ON DELETE set null ON UPDATE no action;