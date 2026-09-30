CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"company" text,
	"team_size" text,
	"message" text NOT NULL,
	"status" text DEFAULT 'nouvelle' NOT NULL,
	"admin_notes" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_at" timestamp with time zone,
	CONSTRAINT "site_requests_kind_check" CHECK (kind = ANY (ARRAY['devis'::text, 'message'::text])),
	CONSTRAINT "site_requests_status_check" CHECK (status = ANY (ARRAY['nouvelle'::text, 'en_cours'::text, 'traitee'::text]))
);
--> statement-breakpoint
CREATE INDEX "idx_site_requests_created_at" ON "site_requests" USING btree ("created_at" DESC NULLS FIRST);