-- Assistant Webo : conversations (historique lisible) et propositions d'actions à valider. Rejouable sans erreur.
CREATE TABLE IF NOT EXISTS "webo_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webo_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "webo_proposals_kind_check" CHECK (kind = ANY (ARRAY['quote'::text, 'invoice'::text, 'prestation'::text, 'prestation_update'::text, 'prospect_reply'::text])),
	CONSTRAINT "webo_proposals_status_check" CHECK (status = ANY (ARRAY['proposed'::text, 'done'::text, 'cancelled'::text, 'failed'::text]))
);
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webo_conversations_company_id_fkey') THEN ALTER TABLE "webo_conversations" ADD CONSTRAINT "webo_conversations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webo_conversations_user_id_fkey') THEN ALTER TABLE "webo_conversations" ADD CONSTRAINT "webo_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webo_proposals_conversation_id_fkey') THEN ALTER TABLE "webo_proposals" ADD CONSTRAINT "webo_proposals_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."webo_conversations"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webo_proposals_company_id_fkey') THEN ALTER TABLE "webo_proposals" ADD CONSTRAINT "webo_proposals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webo_conversations_user" ON "webo_conversations" USING btree ("user_id" uuid_ops,"updated_at" timestamptz_ops);