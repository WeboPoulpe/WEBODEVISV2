-- Webo : habitudes retenues (webo_memories) et nouvelles sortes de propositions (mémoire, modification et envoi de
-- devis). La contrainte est retirée puis remise : rejouable sans erreur.
CREATE TABLE IF NOT EXISTS "webo_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webo_proposals" DROP CONSTRAINT IF EXISTS "webo_proposals_kind_check";--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webo_memories_company_id_fkey') THEN ALTER TABLE "webo_memories" ADD CONSTRAINT "webo_memories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webo_memories_company" ON "webo_memories" USING btree ("company_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "webo_proposals" ADD CONSTRAINT "webo_proposals_kind_check" CHECK (kind = ANY (ARRAY['quote'::text, 'invoice'::text, 'prestation'::text, 'prestation_update'::text, 'prospect_reply'::text, 'memory'::text, 'quote_update'::text, 'quote_send'::text]));