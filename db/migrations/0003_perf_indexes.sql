-- Index sur les colonnes de recherche qui n'en avaient pas : propriétaire des lignes, liens entre tables,
-- et les tris les plus fréquents. Sans eux, chaque lecture parcourt la table entière.

-- Devis : par propriétaire et statut (listes, compteurs), par date d'événement (calendrier, événements)
CREATE INDEX IF NOT EXISTS idx_quotes_owner_status ON public.quotes (owner_user_id, status);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_quotes_user ON public.quotes (user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_quotes_event_date ON public.quotes (event_date);--> statement-breakpoint

-- Notifications : les plus récentes d'un utilisateur
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);--> statement-breakpoint

-- Propriétaire des lignes
CREATE INDEX IF NOT EXISTS idx_customers_user ON public.customers (user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_customer_contacts_owner ON public.customer_contacts (owner_user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_devis_templates_user ON public.devis_templates (user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_extras_user ON public.extras (user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ingredients_user ON public.ingredients (user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ingredients_owner ON public.ingredients (owner_user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_prestations_user ON public.prestations (user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_prospect_requests_owner ON public.prospect_requests (owner_user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_prospect_requests_token ON public.prospect_requests (user_token);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_quote_templates_owner ON public.quote_templates (owner_user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_quote_templates_user ON public.quote_templates (user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_service_ingredients_user ON public.service_ingredients (user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_service_materials_user ON public.service_materials (user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_services_owner ON public.services (owner_user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_suppliers_user ON public.suppliers (user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_suppliers_owner ON public.suppliers (owner_user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_user_prospect_tokens_user ON public.user_prospect_tokens (user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rental_templates_user ON public.rental_templates (user_id);--> statement-breakpoint

-- Liens entre tables
CREATE INDEX IF NOT EXISTS idx_event_extras_extra ON public.event_extras (extra_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_event_ingredients_ingredient ON public.event_ingredients (ingredient_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_event_ingredients_supplier ON public.event_ingredients (supplier_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ingredients_preferred_supplier ON public.ingredients (preferred_supplier_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_quote_services_service ON public.quote_services (service_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rental_items_quote ON public.rental_items (quote_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rental_items_supplier ON public.rental_items (supplier_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_service_ingredients_ingredient ON public.service_ingredients (ingredient_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_services_supplier ON public.services (supplier_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_profiles_parent ON public.profiles (parent_user_id);
