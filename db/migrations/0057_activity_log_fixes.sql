-- Historique (suite de 0056). Rejouable.
-- 1. La purge d'un compte (server/accountPurge.ts, qui signale app.purge) efface aussi son historique : elle supprime
--    les tables enfants avant le compte, et le déclencheur la bloquait.
-- 2. Regroupement : une action de l'équipe WeboDevis ne se fond plus dans celle du client, et deux clients différents
--    qui consultent la même brochure font deux lignes (le résumé, qui porte leur nom, fait partie de la clé).
-- 3. log_activity_batch : les éléments d'une même écriture en un seul appel ; au-delà de 20, ou à la suite d'un lot du
--    même auteur il y a moins de 2 minutes (import en plusieurs envois), une seule ligne qui compte (details.n).
CREATE OR REPLACE FUNCTION public.activity_log_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Purge du compte (app.purge), ou cascade après la suppression du compte : l'effacement est permis.
  IF current_setting('app.purge', true) = 'on' THEN RETURN OLD; END IF;
  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = OLD.company_id) THEN
    RAISE EXCEPTION 'L''historique ne peut pas être effacé';
  END IF;
  RETURN OLD;
END $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.activity_company(p_company uuid, p_actor uuid) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT coalesce(pr.parent_user_id, pr.id) FROM public.profiles pr WHERE pr.id = coalesce(p_company, p_actor)), p_company)
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.log_activity(
  p_company uuid, p_actor uuid, p_via_admin boolean, p_action text, p_entity_type text, p_entity_id uuid,
  p_entity_label text, p_summary text, p_details jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_company uuid := public.activity_company(p_company, p_actor);
  v_label text;
  v_group uuid;
BEGIN
  IF v_company IS NULL THEN RETURN; END IF;
  IF p_actor IS NOT NULL THEN
    SELECT coalesce(nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''), pr.email)
      INTO v_label FROM public.profiles pr WHERE pr.id = p_actor;
  END IF;

  -- Modifications et consultations rapprochées (moins de 10 minutes) du même élément par la même personne : une ligne.
  IF p_action IN ('modification', 'consultation_client') AND p_entity_id IS NOT NULL THEN
    SELECT a.id INTO v_group FROM public.activity_log a
     WHERE a.company_id = v_company AND a.entity_id = p_entity_id AND a.entity_type = p_entity_type
       AND a.action = p_action AND a.actor_id IS NOT DISTINCT FROM p_actor
       AND a.via_admin = coalesce(p_via_admin, false)
       AND (p_action <> 'consultation_client' OR a.summary = p_summary)
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
END $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.log_activity_batch(
  p_actor uuid, p_via_admin boolean, p_action text, p_entity_type text, p_ids uuid[], p_labels text[], p_summaries text[], p_lot_summary text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_company uuid := public.activity_company(null, p_actor);
  v_n int := coalesce(cardinality(p_ids), 0);
  v_lot uuid;
  i int;
BEGIN
  IF v_company IS NULL OR v_n = 0 THEN RETURN; END IF;
  -- Un lot du même auteur il y a moins de 2 minutes : l'import continue, on le prolonge.
  SELECT a.id INTO v_lot FROM public.activity_log a
   WHERE a.company_id = v_company AND a.actor_id IS NOT DISTINCT FROM p_actor AND a.via_admin = coalesce(p_via_admin, false)
     AND a.action = p_action AND a.entity_type = p_entity_type AND a.entity_id IS NULL AND a.details ? 'n'
     AND a.updated_at > now() - interval '2 minutes'
   ORDER BY a.updated_at DESC LIMIT 1;
  IF v_lot IS NOT NULL THEN
    UPDATE public.activity_log
       SET updated_at = now(),
           details = details || jsonb_build_object(
             'n', (details->>'n')::int + v_n,
             'ids', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
               SELECT x FROM jsonb_array_elements(coalesce(details->'ids', '[]'::jsonb) || to_jsonb(p_ids)) x LIMIT 200) s))
     WHERE id = v_lot;
    RETURN;
  END IF;
  IF v_n > 20 THEN
    PERFORM public.log_activity(v_company, p_actor, p_via_admin, p_action, p_entity_type, null, '', p_lot_summary,
      jsonb_build_object('n', v_n, 'ids', (SELECT jsonb_agg(x) FROM (SELECT unnest(p_ids[1:200]) x) s)));
    RETURN;
  END IF;
  FOR i IN 1..v_n LOOP
    PERFORM public.log_activity(v_company, p_actor, p_via_admin, p_action, p_entity_type, p_ids[i], p_labels[i], p_summaries[i], null);
  END LOOP;
END $$;
