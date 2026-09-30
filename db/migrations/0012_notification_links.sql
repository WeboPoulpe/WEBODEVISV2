-- Les notifications de nouvelle demande menaient à /prospect-requests, une page de l'ancienne version (404).
CREATE OR REPLACE FUNCTION public.notify_prospect_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  target_user_id uuid;
BEGIN
  target_user_id := NEW.owner_user_id;
  IF target_user_id IS NULL AND NEW.user_token IS NOT NULL THEN
    target_user_id := public.get_user_id_from_prospect_token(NEW.user_token);
  END IF;
  IF target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    target_user_id,
    'Nouvelle demande de devis',
    NEW.first_name || ' ' || NEW.last_name || ' vous a envoyé une demande de devis.',
    'prospect_request',
    'high',
    jsonb_build_object('prospect_id', NEW.id),
    '/prospects',
    now() + interval '30 days'
  );
  RETURN NEW;
END;
$function$;
--> statement-breakpoint
UPDATE public.notifications SET action_url = '/prospects' WHERE action_url LIKE '/prospect-requests%';
