-- Généré par scripts/build-neon-sql.mjs à partir de l'export Supabase.

-- Utilisateur courant transmis par l'application (remplace auth.uid()) ; NULL si non renseigné.
CREATE OR REPLACE FUNCTION public.current_app_user() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.movement_type = 'in' THEN
    UPDATE ingredients SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity WHERE id = NEW.ingredient_id;
  ELSIF NEW.movement_type = 'out' THEN
    UPDATE ingredients SET stock_quantity = COALESCE(stock_quantity, 0) - NEW.quantity WHERE id = NEW.ingredient_id;
  ELSIF NEW.movement_type = 'adjust' THEN
    UPDATE ingredients SET stock_quantity = NEW.quantity WHERE id = NEW.ingredient_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_briefing_token_expiry(quote_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
AS $function$
DECLARE
  event_date DATE;
BEGIN
  SELECT event_date INTO event_date 
  FROM public.quotes 
  WHERE id = quote_id;
  
  -- Retourner la date de l'événement + 5 jours
  RETURN (event_date + INTERVAL '5 days')::TIMESTAMP WITH TIME ZONE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_stock_alert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  ing RECORD;
BEGIN
  SELECT id, name, stock_quantity, min_stock_alert, unit, user_id
    INTO ing FROM ingredients WHERE id = NEW.ingredient_id;

  IF ing.min_stock_alert IS NOT NULL
     AND ing.min_stock_alert > 0
     AND ing.stock_quantity <= ing.min_stock_alert
     AND ing.user_id IS NOT NULL
  THEN
    -- Vérifie qu'on n'a pas déjà une alerte non lue pour cet ingrédient
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = ing.user_id
        AND type = 'stock_alert'
        AND is_read = false
        AND action_url = '/stock?ing=' || ing.id::text
    ) THEN
      INSERT INTO notifications (user_id, title, message, type, priority, action_url)
      VALUES (
        ing.user_id,
        'Stock bas : ' || ing.name,
        'Stock actuel : ' || COALESCE(ing.stock_quantity::text, '0') || COALESCE(ing.unit, '') ||
          ' (seuil : ' || ing.min_stock_alert::text || COALESCE(ing.unit, '') || ')',
        'stock_alert',
        CASE WHEN ing.stock_quantity <= 0 THEN 'high' ELSE 'medium' END,
        '/stock?ing=' || ing.id::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_upcoming_events()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  event_record RECORD;
BEGIN
  -- Vérifier les événements dans 15 jours
  FOR event_record IN 
    SELECT q.id, q.owner_user_id, q.client_name, q.event_date, q.event_type, q.name
    FROM public.quotes q
    WHERE q.event_date = CURRENT_DATE + interval '15 days'
    AND q.status != 'cancelled'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = q.owner_user_id
      AND n.type = 'upcoming_event'
      AND n.data->>'quote_id' = q.id::text
      AND n.created_at > CURRENT_DATE
    )
  LOOP
    PERFORM public.create_notification(
      event_record.owner_user_id,
      'Événement dans 15 jours',
      'L''événement "' || COALESCE(event_record.name, event_record.event_type) || '" pour ' || event_record.client_name || ' a lieu dans 15 jours. Pensez à finaliser la préparation.',
      'upcoming_event',
      'high',
      jsonb_build_object('quote_id', event_record.id),
      '/quotes/' || event_record.id,
      event_record.event_date + interval '1 day'
    );
  END LOOP;
  
  -- Vérifier les événements dans 7 jours
  FOR event_record IN 
    SELECT q.id, q.owner_user_id, q.client_name, q.event_date, q.event_type, q.name
    FROM public.quotes q
    WHERE q.event_date = CURRENT_DATE + interval '7 days'
    AND q.status != 'cancelled'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = q.owner_user_id
      AND n.type = 'upcoming_event'
      AND n.data->>'quote_id' = q.id::text
      AND n.created_at > CURRENT_DATE - interval '1 day'
    )
  LOOP
    PERFORM public.create_notification(
      event_record.owner_user_id,
      'Événement dans 7 jours',
      'L''événement "' || COALESCE(event_record.name, event_record.event_type) || '" pour ' || event_record.client_name || ' a lieu dans 7 jours. Vérifiez que tout est prêt.',
      'upcoming_event',
      'high',
      jsonb_build_object('quote_id', event_record.id),
      '/quotes/' || event_record.id,
      event_record.event_date + interval '1 day'
    );
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_demo_sessions()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    DELETE FROM public.demo_sessions WHERE expires_at < now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_notifications()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM public.notifications 
  WHERE expires_at IS NOT NULL 
  AND expires_at < now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_title text, p_message text, p_type text, p_priority text DEFAULT 'medium'::text, p_data jsonb DEFAULT NULL::jsonb, p_action_url text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id, title, message, type, priority, data, action_url, expires_at
  ) VALUES (
    p_user_id, p_title, p_message, p_type, p_priority, p_data, p_action_url, p_expires_at
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_invitation_token()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  token TEXT;
BEGIN
  -- Générer un token aléatoire de 32 caractères
  token := encode(gen_random_bytes(24), 'base64');
  -- Remplacer les caractères non-URL-safe
  token := replace(replace(replace(token, '+', '-'), '/', '_'), '=', '');
  RETURN token;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  year_prefix TEXT;
  counter INTEGER;
  invoice_num TEXT;
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO counter
  FROM public.invoices
  WHERE invoice_number LIKE year_prefix || '-%';
  
  invoice_num := year_prefix || '-' || LPAD(counter::TEXT, 4, '0');
  
  RETURN invoice_num;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_po_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  year_prefix TEXT;
  counter INTEGER;
  po_num TEXT;
BEGIN
  year_prefix := 'PO' || TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO counter
  FROM public.purchase_orders
  WHERE po_number LIKE year_prefix || '-%';
  
  po_num := year_prefix || '-' || LPAD(counter::TEXT, 5, '0');
  
  RETURN po_num;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_quote_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  year_prefix TEXT;
  counter INTEGER;
  quote_num TEXT;
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Trouver le prochain numéro disponible pour cette année
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO counter
  FROM public.quotes
  WHERE quote_number LIKE year_prefix || '-%';
  
  -- Formater le numéro: YYYY-0001, YYYY-0002, etc.
  quote_num := year_prefix || '-' || LPAD(counter::TEXT, 4, '0');
  
  RETURN quote_num;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_owner_user_id(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  owner_id UUID;
BEGIN
  SELECT COALESCE(parent_user_id, id) INTO owner_id
  FROM public.profiles
  WHERE id = p_user_id;
  
  RETURN COALESCE(owner_id, p_user_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_id_from_prospect_token(p_token text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT user_id FROM user_prospect_tokens WHERE token = p_token AND is_active = true LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_quotes_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE public.profiles 
    SET quotes_count = quotes_count + 1 
    WHERE id = NEW.owner_user_id;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_prospect_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id uuid;
BEGIN
  -- Cible principale : l'utilisateur propriétaire de la demande
  target_user_id := NEW.owner_user_id;

  -- Compatibilité : si owner_user_id est nul, tenter de dériver via le token
  IF target_user_id IS NULL AND NEW.user_token IS NOT NULL THEN
    target_user_id := public.get_user_id_from_prospect_token(NEW.user_token);
  END IF;

  -- Si on ne peut pas déterminer un propriétaire, ne pas notifier
  IF target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    target_user_id,
    'Nouvelle demande de prospection',
    'Une nouvelle demande de prospection de ' || NEW.first_name || ' ' || NEW.last_name || ' est arrivée.',
    'prospect_request',
    'high',
    jsonb_build_object('prospect_id', NEW.id),
    '/prospect-requests',
    now() + interval '30 days'
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_briefing_token_expiry()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.expires_at := calculate_briefing_token_expiry(NEW.quote_id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_invitation_token()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.token IS NULL THEN
    NEW.token := generate_invitation_token();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_po_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := generate_po_number();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_quote_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := generate_quote_number();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_invoice_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Si le statut est différent de l'ancien
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Insère une nouvelle ligne dans l'historique
    INSERT INTO public.invoice_status_history (invoice_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, public.current_app_user());
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_quote_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.quote_status_history (quote_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, public.current_app_user());
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_collaborators_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_customers_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_event_tasks_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_prospect_requests_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_purchase_order_total()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.purchase_orders
  SET total_amount = (
    SELECT COALESCE(SUM(quantity * unit_price), 0)
    FROM public.purchase_order_items
    WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_quote_total()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.quotes
  SET total_amount = (
    SELECT COALESCE(SUM(quantity * unit_price), 0)
    FROM public.quote_services
    WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_task_templates_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_ticket_updated_at_on_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE public.support_tickets
    SET updated_at = now()
    WHERE id = NEW.ticket_id;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_prospect_tokens_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_prospect_token(token_value text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  token_record record;
BEGIN
  SELECT is_active, brochure_url 
  INTO token_record
  FROM user_prospect_tokens 
  WHERE token = token_value AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false);
  END IF;
  
  RETURN json_build_object(
    'valid', true,
    'brochure_url', token_record.brochure_url
  );
END;
$function$
;

CREATE TRIGGER set_briefing_token_expiry_trigger BEFORE INSERT ON public.briefing_tokens FOR EACH ROW EXECUTE FUNCTION set_briefing_token_expiry();

CREATE TRIGGER update_collaborator_roles_updated_at BEFORE UPDATE ON public.collaborator_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collaborators_updated_at_trigger BEFORE UPDATE ON public.collaborators FOR EACH ROW EXECUTE FUNCTION update_collaborators_updated_at();

CREATE TRIGGER customers_updated_at_trigger BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_customers_updated_at();

CREATE TRIGGER update_event_personal_materials_updated_at BEFORE UPDATE ON public.event_personal_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_tasks_updated_at_trigger BEFORE UPDATE ON public.event_tasks FOR EACH ROW EXECUTE FUNCTION update_event_tasks_updated_at();

CREATE TRIGGER set_invitation_token_trigger BEFORE INSERT ON public.invitation_links FOR EACH ROW EXECUTE FUNCTION set_invitation_token();

CREATE TRIGGER on_invoice_status_change AFTER UPDATE OF status ON public.invoices FOR EACH ROW EXECUTE FUNCTION track_invoice_status_change();

CREATE TRIGGER update_material_categories_updated_at BEFORE UPDATE ON public.material_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personal_materials_updated_at BEFORE UPDATE ON public.personal_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER notify_new_prospect_request AFTER INSERT ON public.prospect_requests FOR EACH ROW EXECUTE FUNCTION notify_prospect_request();

CREATE TRIGGER update_prospect_requests_updated_at_trigger BEFORE UPDATE ON public.prospect_requests FOR EACH ROW EXECUTE FUNCTION update_prospect_requests_updated_at();

CREATE TRIGGER update_purchase_order_total_trigger AFTER INSERT OR DELETE OR UPDATE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION update_purchase_order_total();

CREATE TRIGGER set_po_number_trigger BEFORE INSERT ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION set_po_number();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quote_photos_updated_at BEFORE UPDATE ON public.quote_photos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quote_total_on_delete AFTER DELETE ON public.quote_services FOR EACH ROW EXECUTE FUNCTION update_quote_total();

CREATE TRIGGER update_quote_total_on_insert AFTER INSERT ON public.quote_services FOR EACH ROW EXECUTE FUNCTION update_quote_total();

CREATE TRIGGER update_quote_total_on_update AFTER UPDATE ON public.quote_services FOR EACH ROW EXECUTE FUNCTION update_quote_total();

CREATE TRIGGER track_quote_status_change_trigger AFTER UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION track_quote_status_change();

CREATE TRIGGER trigger_increment_quotes_count AFTER INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION increment_quotes_count();

CREATE TRIGGER trigger_set_quote_number BEFORE INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION set_quote_number();

CREATE TRIGGER update_service_categories_updated_at BEFORE UPDATE ON public.service_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_apply_stock_movement AFTER INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

CREATE TRIGGER trg_check_stock_alert AFTER INSERT ON public.stock_movements FOR EACH ROW WHEN ((new.movement_type = ANY (ARRAY['out'::text, 'adjust'::text]))) EXECUTE FUNCTION check_stock_alert();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER on_new_message_update_ticket AFTER INSERT ON public.support_ticket_messages FOR EACH ROW EXECUTE FUNCTION update_ticket_updated_at_on_new_message();

CREATE TRIGGER on_task_templates_update BEFORE UPDATE ON public.task_templates FOR EACH ROW EXECUTE FUNCTION update_task_templates_updated_at();

CREATE TRIGGER update_user_library_photos_updated_at BEFORE UPDATE ON public.user_library_photos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_prospect_tokens_updated_at BEFORE UPDATE ON public.user_prospect_tokens FOR EACH ROW EXECUTE FUNCTION update_user_prospect_tokens_updated_at();
