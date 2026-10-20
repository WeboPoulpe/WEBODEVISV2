CREATE TABLE "ingredient_stocks" (
	"company_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity" numeric DEFAULT 0 NOT NULL,
	"min_alert" numeric DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_stocks_pkey" PRIMARY KEY("company_id","ingredient_id")
);
--> statement-breakpoint
ALTER TABLE "ingredient_stocks" ADD CONSTRAINT "ingredient_stocks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_stocks" ADD CONSTRAINT "ingredient_stocks_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Entreprise d'un compte : son titulaire (compte parent) s'il en a un, sinon lui-même.
CREATE OR REPLACE FUNCTION public.company_of(p_user uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  SELECT coalesce((SELECT coalesce(parent_user_id, id) FROM public.profiles WHERE id = p_user), p_user)
$function$;
--> statement-breakpoint
-- Un mouvement de stock met à jour le stock de l'entreprise de celui qui le fait, pas la ligne de l'ingrédient
-- (partagée par tous les comptes pour un ingrédient du catalogue commun).
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  company uuid := public.company_of(NEW.user_id);
BEGIN
  INSERT INTO public.ingredient_stocks (company_id, ingredient_id, quantity)
  VALUES (company, NEW.ingredient_id, 0)
  ON CONFLICT (company_id, ingredient_id) DO NOTHING;
  UPDATE public.ingredient_stocks SET
    quantity = CASE NEW.movement_type
      WHEN 'in' THEN quantity + NEW.quantity
      WHEN 'out' THEN quantity - NEW.quantity
      WHEN 'adjust' THEN NEW.quantity
      ELSE quantity END,
    updated_at = now()
  WHERE company_id = company AND ingredient_id = NEW.ingredient_id;
  RETURN NEW;
END;
$function$;
--> statement-breakpoint
-- Alerte de stock bas, sur le stock et le seuil de l'entreprise ; prévient celui qui a fait le mouvement.
CREATE OR REPLACE FUNCTION public.check_stock_alert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  st RECORD;
BEGIN
  SELECT s.quantity, s.min_alert, i.name, i.unit, i.id INTO st
  FROM public.ingredient_stocks s JOIN public.ingredients i ON i.id = s.ingredient_id
  WHERE s.company_id = public.company_of(NEW.user_id) AND s.ingredient_id = NEW.ingredient_id;

  IF st.min_alert > 0 AND st.quantity <= st.min_alert THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = NEW.user_id AND type = 'stock_alert' AND is_read = false AND action_url = '/stock?ing=' || st.id::text
    ) THEN
      INSERT INTO public.notifications (user_id, title, message, type, priority, action_url)
      VALUES (
        NEW.user_id,
        'Stock bas : ' || st.name,
        'Stock actuel : ' || st.quantity::text || COALESCE(' ' || st.unit, '') || ' (seuil : ' || st.min_alert::text || COALESCE(' ' || st.unit, '') || ')',
        'stock_alert',
        CASE WHEN st.quantity <= 0 THEN 'high' ELSE 'medium' END,
        '/stock?ing=' || st.id::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
--> statement-breakpoint
-- Reprise : les ingrédients propres à un compte gardent leur stock et leur seuil, dans l'entreprise du compte.
INSERT INTO public.ingredient_stocks (company_id, ingredient_id, quantity, min_alert)
SELECT public.company_of(i.user_id), i.id, coalesce(i.stock_quantity, 0), coalesce(i.min_stock_alert, 0)
FROM public.ingredients i
WHERE i.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = public.company_of(i.user_id))
ON CONFLICT (company_id, ingredient_id) DO NOTHING;
--> statement-breakpoint
-- Ingrédients du catalogue commun : le stock de chaque entreprise est recalculé à partir de ses propres mouvements
-- (le dernier inventaire, puis les entrées et sorties qui ont suivi).
INSERT INTO public.ingredient_stocks (company_id, ingredient_id, quantity)
SELECT company, ingredient_id,
  coalesce(max(quantity) FILTER (WHERE movement_type = 'adjust' AND created_at = last_adjust), 0)
  + coalesce(sum(quantity) FILTER (WHERE movement_type = 'in' AND (last_adjust IS NULL OR created_at > last_adjust)), 0)
  - coalesce(sum(quantity) FILTER (WHERE movement_type = 'out' AND (last_adjust IS NULL OR created_at > last_adjust)), 0)
FROM (
  SELECT public.company_of(m.user_id) AS company, m.ingredient_id, m.movement_type, m.quantity, m.created_at,
    max(m.created_at) FILTER (WHERE m.movement_type = 'adjust') OVER (PARTITION BY public.company_of(m.user_id), m.ingredient_id) AS last_adjust
  FROM public.stock_movements m
  JOIN public.ingredients i ON i.id = m.ingredient_id AND i.user_id IS NULL
) moves
WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = company)
GROUP BY company, ingredient_id
ON CONFLICT (company_id, ingredient_id) DO NOTHING;
