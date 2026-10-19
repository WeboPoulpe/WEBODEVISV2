CREATE TABLE "customer_invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"paid_on" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" text DEFAULT 'virement' NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"quote_id" uuid,
	"kind" text NOT NULL,
	"status" text DEFAULT 'brouillon' NOT NULL,
	"credited_invoice_id" uuid,
	"number" text,
	"issue_date" date,
	"due_date" date,
	"service_date" date,
	"seller" jsonb NOT NULL,
	"buyer" jsonb NOT NULL,
	"lines" jsonb NOT NULL,
	"total_ht" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total_vat" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total_ttc" numeric(12, 2) DEFAULT 0 NOT NULL,
	"vat_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"pdf_url" text,
	"issued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_invoices_kind_check" CHECK (kind = ANY (ARRAY['acompte'::text, 'solde'::text, 'facture'::text, 'avoir'::text])),
	CONSTRAINT "customer_invoices_status_check" CHECK (status = ANY (ARRAY['brouillon'::text, 'emise'::text, 'payee_partiellement'::text, 'payee'::text, 'annulee'::text])),
	CONSTRAINT "customer_invoices_number_check" CHECK ((status = 'brouillon') = (number IS NULL))
);
--> statement-breakpoint
ALTER TABLE "customer_invoice_payments" ADD CONSTRAINT "customer_invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."customer_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoice_payments" ADD CONSTRAINT "customer_invoice_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_credited_invoice_id_fkey" FOREIGN KEY ("credited_invoice_id") REFERENCES "public"."customer_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_customer_invoice_payments_invoice" ON "customer_invoice_payments" USING btree ("invoice_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_customer_invoices_owner" ON "customer_invoices" USING btree ("owner_user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_customer_invoices_quote" ON "customer_invoices" USING btree ("quote_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "customer_invoices_owner_number_key" ON "customer_invoices" USING btree ("owner_user_id" uuid_ops,"number" text_ops);--> statement-breakpoint
-- Une facture émise est figée : seuls son statut de paiement (ou d'annulation) et son PDF peuvent encore changer,
-- et elle ne se supprime pas. Garde-fou en base, quel que soit le code qui écrit.
CREATE OR REPLACE FUNCTION public.protect_issued_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.status = 'brouillon' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une facture émise ne peut pas être supprimée : établissez un avoir.' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status = 'brouillon'
     OR (to_jsonb(NEW) - ARRAY['status', 'pdf_url', 'updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'pdf_url', 'updated_at'])
     OR (OLD.pdf_url IS NOT NULL AND NEW.pdf_url IS DISTINCT FROM OLD.pdf_url) THEN
    RAISE EXCEPTION 'Une facture émise ne peut pas être modifiée : établissez un avoir.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;
--> statement-breakpoint
CREATE TRIGGER trigger_protect_issued_invoice BEFORE UPDATE OR DELETE ON public.customer_invoices FOR EACH ROW EXECUTE FUNCTION public.protect_issued_invoice();
