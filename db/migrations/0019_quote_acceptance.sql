CREATE TABLE "quote_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"signer_name" text NOT NULL,
	"signer_role" text,
	"signature" text NOT NULL,
	"content_hash" text NOT NULL,
	"total_ttc" numeric(12, 2),
	"ip" text,
	"user_agent" text,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invalidated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_check";--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "valid_until" date;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "viewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD CONSTRAINT "quote_acceptances_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_quote_acceptances_quote" ON "quote_acceptances" USING btree ("quote_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check" CHECK (type = ANY (ARRAY['prospect_request'::text, 'upcoming_event'::text, 'invoice_due'::text, 'support_ticket'::text, 'system_update'::text, 'task_reminder'::text, 'stock_alert'::text, 'extra_response'::text, 'quote_accepted'::text]));--> statement-breakpoint
-- Un devis accepté puis modifié (lignes, document, TVA, couverts, date) : l'acceptation porte sur une version
-- précédente. Elle reste enregistrée comme preuve, mais n'est plus « en cours ».
CREATE OR REPLACE FUNCTION public.invalidate_quote_acceptance()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.services IS DISTINCT FROM OLD.services
     OR NEW.content_html IS DISTINCT FROM OLD.content_html
     OR NEW.vat_rate IS DISTINCT FROM OLD.vat_rate
     OR NEW.guest_count IS DISTINCT FROM OLD.guest_count
     OR NEW.guest_count_adults IS DISTINCT FROM OLD.guest_count_adults
     OR NEW.guest_count_children IS DISTINCT FROM OLD.guest_count_children
     OR NEW.event_date IS DISTINCT FROM OLD.event_date THEN
    UPDATE public.quote_acceptances SET invalidated_at = now()
    WHERE quote_id = NEW.id AND invalidated_at IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;
--> statement-breakpoint
CREATE TRIGGER trigger_invalidate_quote_acceptance AFTER UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.invalidate_quote_acceptance();
