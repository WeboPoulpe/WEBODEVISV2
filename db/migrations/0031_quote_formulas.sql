-- Formules au choix dans un devis (« Formule Prestige / Formule Tradition ») : le client choisit en signant.
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "formulas" jsonb;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "chosen_formula_id" text;--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD COLUMN IF NOT EXISTS "formula_id" text;--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD COLUMN IF NOT EXISTS "formula_name" text;--> statement-breakpoint
-- Un changement des formules ou de la formule retenue rend aussi caduque une acceptation en cours : elle porte
-- sur une version précédente. (L'acceptation en ligne enregistre la formule avant d'insérer l'accord.)
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
     OR NEW.event_date IS DISTINCT FROM OLD.event_date
     OR NEW.formulas IS DISTINCT FROM OLD.formulas
     OR NEW.chosen_formula_id IS DISTINCT FROM OLD.chosen_formula_id THEN
    UPDATE public.quote_acceptances SET invalidated_at = now()
    WHERE quote_id = NEW.id AND invalidated_at IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;
