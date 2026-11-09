-- Brochures : versions des pages du Studio, commentaires, validation avant envoi, modèles de pages de l'entreprise. Additive et rejouable.
CREATE TABLE IF NOT EXISTS "brochure_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brochure_id" uuid NOT NULL,
	"page_id" text,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brochure_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brochure_id" uuid NOT NULL,
	"studio" jsonb NOT NULL,
	"label" text,
	"auto" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "studio_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"page" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brochures" ADD COLUMN IF NOT EXISTS "review_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "brochures" ADD COLUMN IF NOT EXISTS "review_note" text;--> statement-breakpoint
ALTER TABLE "brochures" ADD COLUMN IF NOT EXISTS "review_requested_by" uuid;--> statement-breakpoint
ALTER TABLE "brochures" ADD COLUMN IF NOT EXISTS "review_by" uuid;--> statement-breakpoint
ALTER TABLE "brochures" ADD COLUMN IF NOT EXISTS "review_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "brochure_comments" DROP CONSTRAINT IF EXISTS "brochure_comments_brochure_id_fkey";--> statement-breakpoint
ALTER TABLE "brochure_comments" ADD CONSTRAINT "brochure_comments_brochure_id_fkey" FOREIGN KEY ("brochure_id") REFERENCES "public"."brochures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brochure_versions" DROP CONSTRAINT IF EXISTS "brochure_versions_brochure_id_fkey";--> statement-breakpoint
ALTER TABLE "brochure_versions" ADD CONSTRAINT "brochure_versions_brochure_id_fkey" FOREIGN KEY ("brochure_id") REFERENCES "public"."brochures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_brochure_comments_brochure" ON "brochure_comments" USING btree ("brochure_id" uuid_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_brochure_versions_brochure" ON "brochure_versions" USING btree ("brochure_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_studio_templates_owner" ON "studio_templates" USING btree ("owner_user_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "brochures" DROP CONSTRAINT IF EXISTS "brochures_review_status_check";--> statement-breakpoint
ALTER TABLE "brochures" ADD CONSTRAINT "brochures_review_status_check" CHECK (review_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text, 'changes'::text]));