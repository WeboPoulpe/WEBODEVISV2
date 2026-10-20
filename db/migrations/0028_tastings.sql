CREATE TABLE "tastings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"quote_id" uuid,
	"client_name" text NOT NULL,
	"client_email" text,
	"client_phone" text,
	"tasting_date" date NOT NULL,
	"start_time" time NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"location" text,
	"guest_count" integer,
	"notes" text,
	"status" text DEFAULT 'prevu' NOT NULL,
	"notify_client" boolean DEFAULT true NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"early_reminder_sent_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tastings_status_check" CHECK (status = ANY (ARRAY['prevu'::text, 'fait'::text, 'annule'::text])),
	CONSTRAINT "tastings_duration_check" CHECK (duration_minutes > 0 AND duration_minutes <= 720)
);
--> statement-breakpoint
ALTER TABLE "tastings" ADD CONSTRAINT "tastings_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tastings" ADD CONSTRAINT "tastings_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tastings" ADD CONSTRAINT "tastings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tastings_owner_date" ON "tastings" USING btree ("owner_user_id" uuid_ops,"tasting_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_tastings_quote" ON "tastings" USING btree ("quote_id" uuid_ops);