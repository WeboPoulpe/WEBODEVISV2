-- Historique des actions de l'entreprise (page Historique) : qui a fait quoi, le jour et l'heure. Inaltérable : une
-- ligne ne peut être ni effacée ni réécrite ; seul le regroupement de modifications rapprochées prolonge une ligne
-- (updated_at, details). La suppression complète du compte emporte son historique (cascade). Additive et rejouable.
CREATE TABLE IF NOT EXISTS "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_label" text,
	"via_admin" boolean DEFAULT false NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"entity_label" text NOT NULL,
	"summary" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "users"("id") ON DELETE CASCADE
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_log_company_created" ON "activity_log" ("company_id", "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_log_company_entity" ON "activity_log" ("company_id", "entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_log_company_actor" ON "activity_log" ("company_id", "actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_log_group" ON "activity_log" ("company_id", "entity_id", "updated_at" DESC);--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.activity_log_no_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id, NEW.company_id, NEW.actor_id, NEW.actor_label, NEW.via_admin, NEW.action, NEW.entity_type, NEW.entity_id,
      NEW.entity_label, NEW.summary, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.company_id, OLD.actor_id, OLD.actor_label, OLD.via_admin, OLD.action, OLD.entity_type, OLD.entity_id,
      OLD.entity_label, OLD.summary, OLD.created_at) THEN
    RAISE EXCEPTION 'L''historique ne peut pas être modifié';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.activity_log_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Pendant la suppression du compte (cascade), le compte n'existe déjà plus : l'effacement est permis.
  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = OLD.company_id) THEN
    RAISE EXCEPTION 'L''historique ne peut pas être effacé';
  END IF;
  RETURN OLD;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS activity_log_no_update ON "activity_log";--> statement-breakpoint
CREATE TRIGGER activity_log_no_update BEFORE UPDATE ON "activity_log" FOR EACH ROW EXECUTE FUNCTION public.activity_log_no_update();--> statement-breakpoint
DROP TRIGGER IF EXISTS activity_log_no_delete ON "activity_log";--> statement-breakpoint
CREATE TRIGGER activity_log_no_delete BEFORE DELETE ON "activity_log" FOR EACH ROW EXECUTE FUNCTION public.activity_log_no_delete();--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.log_activity(
  p_company uuid, p_actor uuid, p_via_admin boolean, p_action text, p_entity_type text, p_entity_id uuid,
  p_entity_label text, p_summary text, p_details jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_company uuid := p_company;
  v_label text;
  v_group uuid;
BEGIN
  IF p_actor IS NOT NULL THEN
    SELECT coalesce(v_company, coalesce(pr.parent_user_id, pr.id)),
           coalesce(nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''), pr.email)
      INTO v_company, v_label
      FROM public.profiles pr WHERE pr.id = p_actor;
    v_company := coalesce(v_company, p_company);
  END IF;
  IF v_company IS NULL THEN RETURN; END IF;

  -- Modifications et consultations rapprochées (moins de 10 minutes) du même élément par la même personne : une ligne.
  IF p_action IN ('modification', 'consultation_client') AND p_entity_id IS NOT NULL THEN
    SELECT a.id INTO v_group FROM public.activity_log a
     WHERE a.company_id = v_company AND a.entity_id = p_entity_id AND a.entity_type = p_entity_type
       AND a.action = p_action AND a.actor_id IS NOT DISTINCT FROM p_actor
       AND a.updated_at > now() - interval '10 minutes'
     ORDER BY a.updated_at DESC LIMIT 1;
    IF v_group IS NOT NULL THEN
      UPDATE public.activity_log
         SET updated_at = now(),
             details = coalesce(details, '{}'::jsonb) || jsonb_build_object('count', coalesce((details->>'count')::int, 1) + 1)
       WHERE id = v_group;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.activity_log (company_id, actor_id, actor_label, via_admin, action, entity_type, entity_id, entity_label, summary, details)
  VALUES (v_company, p_actor, v_label, coalesce(p_via_admin, false), p_action, p_entity_type, p_entity_id,
          coalesce(p_entity_label, ''), p_summary, coalesce(p_details, '{}'::jsonb) || '{"count": 1}'::jsonb);
END $$;
