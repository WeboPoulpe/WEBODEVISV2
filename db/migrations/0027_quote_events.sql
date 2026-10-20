CREATE TABLE "quote_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"actor_id" uuid,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_events_kind_check" CHECK (kind = ANY (ARRAY['envoi_email'::text, 'envoi_whatsapp'::text, 'consultation'::text]))
);
--> statement-breakpoint
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_quote_events_quote" ON "quote_events" USING btree ("quote_id" uuid_ops,"created_at" timestamptz_ops);