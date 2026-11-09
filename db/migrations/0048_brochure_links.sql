-- Brochures : liens par source ou par client, expiration et code d'accès, notifications au traiteur. Additive et rejouable.
CREATE TABLE IF NOT EXISTS "brochure_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brochure_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"kind" text DEFAULT 'source' NOT NULL,
	"label" text NOT NULL,
	"greeting" text,
	"expires_at" timestamp with time zone,
	"access_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"viewed_at" timestamp with time zone,
	"open_notified_at" timestamp with time zone,
	"form_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brochure_links_token_key" UNIQUE("token"),
	CONSTRAINT "brochure_links_kind_check" CHECK (kind = ANY (ARRAY['source'::text, 'client'::text]))
);
--> statement-breakpoint
ALTER TABLE "brochures" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "brochures" ADD COLUMN IF NOT EXISTS "access_code" text;--> statement-breakpoint
ALTER TABLE "brochures" ADD COLUMN IF NOT EXISTS "notify" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "brochures" ADD COLUMN IF NOT EXISTS "open_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "brochures" ADD COLUMN IF NOT EXISTS "form_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prospect_requests" ADD COLUMN IF NOT EXISTS "brochure_link_id" uuid;--> statement-breakpoint
ALTER TABLE "brochure_links" DROP CONSTRAINT IF EXISTS "brochure_links_brochure_id_fkey";--> statement-breakpoint
ALTER TABLE "brochure_links" ADD CONSTRAINT "brochure_links_brochure_id_fkey" FOREIGN KEY ("brochure_id") REFERENCES "public"."brochures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_brochure_links_brochure" ON "brochure_links" USING btree ("brochure_id" uuid_ops);