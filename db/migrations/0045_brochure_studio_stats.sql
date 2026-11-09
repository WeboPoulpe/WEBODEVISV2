-- Brochures du Studio : lecture page par page (ouvertures, temps passé) et création de brochure par Webo. Additive et rejouable.
CREATE TABLE IF NOT EXISTS "brochure_page_stats" (
	"brochure_id" uuid NOT NULL,
	"page" integer NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"ms" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brochure_page_stats_pkey" PRIMARY KEY("brochure_id","page")
);
--> statement-breakpoint
ALTER TABLE "webo_proposals" DROP CONSTRAINT IF EXISTS "webo_proposals_kind_check";--> statement-breakpoint
ALTER TABLE "brochure_page_stats" DROP CONSTRAINT IF EXISTS "brochure_page_stats_brochure_id_fkey";--> statement-breakpoint
ALTER TABLE "brochure_page_stats" ADD CONSTRAINT "brochure_page_stats_brochure_id_fkey" FOREIGN KEY ("brochure_id") REFERENCES "public"."brochures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webo_proposals" ADD CONSTRAINT "webo_proposals_kind_check" CHECK (kind = ANY (ARRAY['quote'::text, 'invoice'::text, 'prestation'::text, 'prestation_update'::text, 'prospect_reply'::text, 'memory'::text, 'quote_update'::text, 'quote_send'::text, 'event_update'::text, 'courses_recalc'::text, 'customer_upsert'::text, 'prospect_status'::text, 'prospect_to_quote'::text, 'stock_movement'::text, 'supplier_order'::text, 'supplier_order_send'::text, 'supplier_order_receive'::text, 'event_orders'::text, 'brochure_send'::text, 'brochure_update'::text, 'brochure_create'::text, 'invoice_issue'::text, 'invoice_payment'::text]));