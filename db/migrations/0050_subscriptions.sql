-- Abonnement Stripe : état d'abonnement par entreprise, évènements Stripe déjà traités, comptes bêta offerts. Additive et rejouable.
CREATE TABLE IF NOT EXISTS "company_subscriptions" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" text,
	"status" text DEFAULT 'none' NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"anchor_day" integer,
	"ever_subscribed" boolean DEFAULT false NOT NULL,
	"comped" boolean DEFAULT false NOT NULL,
	"comped_note" text DEFAULT '' NOT NULL,
	"last_event_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_subscriptions_stripe_customer_id_key" UNIQUE("stripe_customer_id"),
	CONSTRAINT "company_subscriptions_plan_check" CHECK (plan IS NULL OR plan = ANY (ARRAY['mensuel'::text, 'annuel'::text])),
	CONSTRAINT "company_subscriptions_anchor_day_check" CHECK (anchor_day IS NULL OR (anchor_day >= 1 AND anchor_day <= 31))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
-- Bêta : chaque titulaire existant (ni collaborateur, ni admin, ni démo) est offert.
INSERT INTO "company_subscriptions" ("company_id", "comped", "comped_note", "ever_subscribed")
SELECT p.id, true, 'Bêta', true FROM "profiles" p
WHERE p.parent_user_id IS NULL AND p.role <> 'admin' AND p.id <> '0d3e0000-0000-4000-8000-000000000001'
ON CONFLICT DO NOTHING;
