-- WeboCoins : portefeuille d'une entreprise (pièces du mois, pièces gardées, mode de traduction) et journal de ses
-- mouvements, avec le coût réel des appels à Claude. Rejouable sans erreur.
CREATE TABLE IF NOT EXISTS "webo_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"coins" integer NOT NULL,
	"from_month" integer DEFAULT 0 NOT NULL,
	"from_kept" integer DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"idempotency_key" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(12, 6),
	CONSTRAINT "webo_ledger_kind_check" CHECK (kind = ANY (ARRAY['allocation'::text, 'debit'::text, 'refund'::text, 'gift'::text, 'purchase'::text]))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webo_wallets" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"month_key" text DEFAULT '' NOT NULL,
	"month_coins" integer DEFAULT 0 NOT NULL,
	"kept_coins" integer DEFAULT 0 NOT NULL,
	"monthly_override" integer,
	"translation_mode" text DEFAULT 'webo' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webo_wallets_month_coins_check" CHECK (month_coins >= 0),
	CONSTRAINT "webo_wallets_kept_coins_check" CHECK (kept_coins >= 0),
	CONSTRAINT "webo_wallets_override_check" CHECK (monthly_override IS NULL OR monthly_override >= 0),
	CONSTRAINT "webo_wallets_mode_check" CHECK (translation_mode = ANY (ARRAY['webo'::text, 'free'::text]))
);
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webo_ledger_company_id_fkey') THEN ALTER TABLE "webo_ledger" ADD CONSTRAINT "webo_ledger_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webo_wallets_company_id_fkey') THEN ALTER TABLE "webo_wallets" ADD CONSTRAINT "webo_wallets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webo_ledger_idempotency_key" ON "webo_ledger" USING btree ("idempotency_key" text_ops) WHERE (idempotency_key IS NOT NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webo_ledger_company" ON "webo_ledger" USING btree ("company_id" uuid_ops,"created_at" timestamptz_ops);