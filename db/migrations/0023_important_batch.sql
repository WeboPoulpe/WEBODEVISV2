CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"target_user_id" uuid,
	"action" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" text NOT NULL,
	"company_role" text DEFAULT 'commercial' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "document_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"quote_id" uuid,
	"invoice_id" uuid,
	"sent_to" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_reminders_kind_check" CHECK (kind = ANY (ARRAY['devis'::text, 'facture'::text]))
);
--> statement-breakpoint
ALTER TABLE "event_extras" ADD COLUMN "hours_worked" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "event_extras" ADD COLUMN "hourly_rate" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "extras" ADD COLUMN "hourly_rate" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "auto_reminders" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "reminder_delay_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "ical_token" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "company_role" text DEFAULT 'gerant' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "run_sheet" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "onsite_contact" text;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reminders" ADD CONSTRAINT "document_reminders_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reminders" ADD CONSTRAINT "document_reminders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reminders" ADD CONSTRAINT "document_reminders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."customer_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_log_created" ON "audit_log" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_document_reminders_quote" ON "document_reminders" USING btree ("quote_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_document_reminders_invoice" ON "document_reminders" USING btree ("invoice_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_ical_token_unique" UNIQUE("ical_token");