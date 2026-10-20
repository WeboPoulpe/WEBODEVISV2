ALTER TABLE "profiles" ADD COLUMN "deletion_requested_at" timestamp with time zone;--> statement-breakpoint
-- La purge d'un compte supprimé (après le délai de 30 jours) peut effacer ses factures émises :
-- elle le signale par app.purge pour la transaction en cours. Sinon, la protection reste entière.
CREATE OR REPLACE FUNCTION public.protect_issued_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.status = 'brouillon' OR current_setting('app.purge', true) = 'on' THEN
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
