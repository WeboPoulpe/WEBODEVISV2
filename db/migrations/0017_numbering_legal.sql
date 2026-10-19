CREATE TABLE "document_counters" (
	"owner_user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"last_value" integer NOT NULL,
	CONSTRAINT "document_counters_pkey" PRIMARY KEY("owner_user_id","kind","year")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "numbering" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "legal_form" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "share_capital" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "rcs" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "vat_exempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "payment_terms_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "deposit_percent" numeric DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "quote_validity_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "document_counters" ADD CONSTRAINT "document_counters_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Fonctions de numérotation
-- Prochain numéro d'un document pour l'entreprise de p_user (compte parent s'il y en a un), au format choisi
-- dans profiles.numbering. Le compteur est incrémenté dans la transaction appelante : si la création du
-- document échoue, il revient en arrière, donc les numéros se suivent sans trou.
CREATE OR REPLACE FUNCTION public.next_document_number(p_user uuid, p_kind text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  company uuid;
  fmt jsonb;
  prefix text;
  with_year boolean;
  digits integer;
  yr integer;
  n integer;
BEGIN
  SELECT coalesce(parent_user_id, id) INTO company FROM public.profiles WHERE id = p_user;
  company := coalesce(company, p_user);
  SELECT numbering -> p_kind INTO fmt FROM public.profiles WHERE id = company;
  prefix := coalesce(fmt ->> 'prefix', CASE p_kind WHEN 'quote' THEN 'D-' WHEN 'invoice' THEN 'F-' WHEN 'credit' THEN 'AV-' ELSE '' END);
  with_year := coalesce((fmt ->> 'withYear')::boolean, true);
  digits := least(greatest(coalesce((fmt ->> 'digits')::integer, 4), 1), 8);
  yr := CASE WHEN with_year THEN extract(year FROM current_date)::integer ELSE 0 END;

  INSERT INTO public.document_counters (owner_user_id, kind, year, last_value)
  VALUES (company, p_kind, yr, 1)
  ON CONFLICT (owner_user_id, kind, year) DO UPDATE SET last_value = public.document_counters.last_value + 1
  RETURNING last_value INTO n;

  RETURN prefix || CASE WHEN with_year THEN yr::text || '-' ELSE '' END || lpad(n::text, digits, '0');
END;
$function$;
--> statement-breakpoint
-- Les devis prennent désormais un numéro propre à chaque entreprise (l'ancien comptait sur toute la plateforme).
CREATE OR REPLACE FUNCTION public.set_quote_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := public.next_document_number(coalesce(NEW.owner_user_id, NEW.user_id), 'quote');
  END IF;
  RETURN NEW;
END;
$function$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trigger_set_quote_number ON public.quotes;--> statement-breakpoint
CREATE TRIGGER trigger_set_quote_number BEFORE INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.set_quote_number();
