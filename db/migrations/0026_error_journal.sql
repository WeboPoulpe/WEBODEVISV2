CREATE TABLE "error_groups" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"last_path" text,
	"last_user_id" uuid,
	"last_user_agent" text,
	"digest" text,
	"count" integer DEFAULT 1 NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "error_groups_source_check" CHECK (source = ANY (ARRAY['navigateur'::text, 'serveur'::text]))
);
--> statement-breakpoint
CREATE INDEX "idx_error_groups_last_seen" ON "error_groups" USING btree ("last_seen" timestamptz_ops);