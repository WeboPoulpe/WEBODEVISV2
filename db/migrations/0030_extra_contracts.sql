CREATE TABLE "employer_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"naf_code" text,
	"urssaf" text,
	"convention" text,
	"retirement_fund" text,
	"provident_fund" text,
	"health_service" text,
	"meal_terms" text,
	"trial_terms" text,
	"signatory_name" text,
	"signatory_title" text,
	"signature_city" text,
	"extra_clauses" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extra_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_extra_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"terms" jsonb,
	"status" text DEFAULT 'brouillon' NOT NULL,
	"snapshot" jsonb,
	"content_hash" text,
	"sent_at" timestamp with time zone,
	"signed_on_paper" boolean DEFAULT false NOT NULL,
	"signer_name" text,
	"signature" text,
	"signed_at" timestamp with time zone,
	"signer_ip" text,
	"signer_user_agent" text,
	"dpae_done" boolean DEFAULT false NOT NULL,
	"dpae_date" date,
	"dpae_ack_number" text,
	"dpae_reminded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extra_contracts_status_check" CHECK (status = ANY (ARRAY['brouillon'::text, 'envoye'::text, 'signe'::text]))
);
--> statement-breakpoint
CREATE TABLE "extra_hr_details" (
	"extra_id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"birth_name" text,
	"usage_name" text,
	"first_names" text,
	"sex" text,
	"birth_date" date,
	"birth_city" text,
	"birth_department" text,
	"birth_country" text,
	"nationality" text,
	"social_security_number" text,
	"address" text,
	"postal_code" text,
	"city" text,
	"iban" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extra_hr_details_sex_check" CHECK (sex IS NULL OR sex = ANY (ARRAY['F'::text, 'M'::text]))
);
--> statement-breakpoint
ALTER TABLE "employer_settings" ADD CONSTRAINT "employer_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extra_contracts" ADD CONSTRAINT "extra_contracts_event_extra_id_fkey" FOREIGN KEY ("event_extra_id") REFERENCES "public"."event_extras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extra_contracts" ADD CONSTRAINT "extra_contracts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extra_hr_details" ADD CONSTRAINT "extra_hr_details_extra_id_fkey" FOREIGN KEY ("extra_id") REFERENCES "public"."extras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extra_hr_details" ADD CONSTRAINT "extra_hr_details_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "extra_contracts_event_extra_id_key" ON "extra_contracts" USING btree ("event_extra_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_extra_contracts_owner" ON "extra_contracts" USING btree ("owner_user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_extra_hr_details_owner" ON "extra_hr_details" USING btree ("owner_user_id" uuid_ops);