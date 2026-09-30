-- Généré par scripts/build-neon-sql.mjs à partir de l'export Supabase. Ne pas modifier à la main.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.customer_type AS ENUM ('particulier', 'entreprise');

CREATE TYPE public.subscription_type AS ENUM ('free', 'premium', 'entreprise');

CREATE TYPE public.support_ticket_status AS ENUM ('Ouvert', 'En cours', 'En attente de réponse', 'Résolu', 'Fermé');

CREATE TYPE public.support_ticket_type AS ENUM ('Bug technique', 'Question fonctionnelle', 'Suggestion d''amélioration', 'Problème de facturation', 'Autre');

CREATE TYPE public.user_role AS ENUM ('admin', 'user');

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.password_reset_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone
);

CREATE TABLE public.briefing_tokens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quote_id uuid NOT NULL,
  collaborator_id uuid NOT NULL,
  token uuid DEFAULT gen_random_uuid() NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.collaborator_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.collaborators (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  role text,
  phone text,
  notes text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.customer_contacts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  customer_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  notes text,
  is_primary boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.customers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  customer_type customer_type NOT NULL,
  email text NOT NULL,
  phone text,
  address text,
  service_address text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  first_name text,
  last_name text,
  company_name text,
  siret_number text,
  contact_person_name text,
  contact_person_email text,
  contact_person_phone text,
  owner_user_id uuid NOT NULL,
  user_id uuid
);

CREATE TABLE public.demo_quote_services (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quote_id uuid,
  service_id uuid,
  quantity integer DEFAULT 1,
  unit_price numeric NOT NULL,
  is_option boolean DEFAULT false,
  is_free boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  cost_price numeric DEFAULT 0
);

CREATE TABLE public.demo_quotes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id text,
  client_name text NOT NULL,
  event_date date NOT NULL,
  event_type text NOT NULL,
  guest_count integer NOT NULL,
  total_amount numeric DEFAULT 0,
  status text DEFAULT 'draft'::text,
  remarks text,
  name text,
  created_at timestamp with time zone DEFAULT now(),
  total_cost_price numeric DEFAULT 0
);

CREATE TABLE public.demo_services (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id text,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  is_variable_price boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  cost_price numeric DEFAULT 0
);

CREATE TABLE public.demo_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + '01:00:00'::interval)
);

CREATE TABLE public.devis_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  services jsonb DEFAULT '[]'::jsonb,
  content_html text,
  template text DEFAULT 'standard'::text,
  selected_font text,
  selected_font_size integer DEFAULT 12,
  remarks text,
  vat_rate numeric DEFAULT 20,
  hide_price boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.event_attachment_visibility (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  attachment_id uuid NOT NULL,
  collaborator_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.event_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quote_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  visibility_type text DEFAULT 'all'::text,
  visible_to_collaborators uuid[] DEFAULT '{}'::uuid[]
);

CREATE TABLE public.event_extras (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quote_id uuid NOT NULL,
  extra_id uuid NOT NULL,
  status text DEFAULT 'a_solliciter'::text NOT NULL,
  arrival_time text,
  mission_notes text,
  assign_courses boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.event_ingredients (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quote_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity numeric DEFAULT 1 NOT NULL,
  unit text,
  supplier_id uuid,
  notes text,
  checked boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.event_personal_materials (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quote_id uuid NOT NULL,
  personal_material_id uuid NOT NULL,
  allocated_quantity integer DEFAULT 0 NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  assigned_to uuid
);

CREATE TABLE public.event_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quote_id uuid NOT NULL,
  name text NOT NULL,
  assigned_to uuid,
  status text DEFAULT 'a_faire'::text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.event_team_assignments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quote_id uuid NOT NULL,
  collaborator_id uuid NOT NULL,
  assigned_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL
);

CREATE TABLE public.extras (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  role text,
  access_token text DEFAULT encode(gen_random_bytes(16), 'hex'::text),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ingredients (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id uuid,
  name text NOT NULL,
  category text,
  unit text DEFAULT 'Unité'::text,
  image_url text,
  off_product_id text,
  created_at timestamp with time zone DEFAULT now(),
  sub_category text,
  user_id uuid,
  stock_quantity numeric DEFAULT 0,
  min_stock_alert numeric DEFAULT 0,
  volume_unit_price numeric DEFAULT 0,
  preferred_supplier_id uuid
);

CREATE TABLE public.invitation_links (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  token text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
  used_at timestamp with time zone,
  used_by uuid,
  is_active boolean DEFAULT true NOT NULL,
  max_uses integer DEFAULT 1 NOT NULL,
  current_uses integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.invoice_services (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  invoice_id uuid NOT NULL,
  service_name text NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  unit_price numeric NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.invoice_status_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  invoice_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_at timestamp with time zone DEFAULT now() NOT NULL,
  changed_by uuid NOT NULL,
  notes text
);

CREATE TABLE public.invoices (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quote_id uuid NOT NULL,
  invoice_number text NOT NULL,
  owner_user_id uuid NOT NULL,
  client_name text NOT NULL,
  total_amount numeric NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  invoice_date date DEFAULT CURRENT_DATE NOT NULL,
  due_date date DEFAULT (CURRENT_DATE + '30 days'::interval) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.material_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  priority text DEFAULT 'medium'::text NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  data jsonb,
  action_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  read_at timestamp with time zone,
  expires_at timestamp with time zone
);

CREATE TABLE public.personal_materials (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  total_quantity integer DEFAULT 0 NOT NULL,
  category text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.prestation_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  name text NOT NULL,
  icon text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.prestation_subcategories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  category_id uuid NOT NULL,
  user_id uuid,
  name text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.prestations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  unit_price numeric DEFAULT 0 NOT NULL,
  category text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  sub_category text,
  is_option boolean DEFAULT false,
  cost_price numeric DEFAULT 0,
  gastro_card_html text,
  gastro_card_html_en text,
  category_id uuid,
  sub_category_id uuid,
  child_unit_price numeric,
  photo_url text
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  role user_role DEFAULT 'user'::user_role NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  subscription_type text DEFAULT 'free'::text,
  company_name text,
  company_siret text,
  company_address text,
  company_phone text,
  company_email text,
  company_logo_url text,
  company_cgv text,
  company_website text,
  completed_tutorial_pages jsonb DEFAULT '[]'::jsonb,
  pdf_main_color text DEFAULT '#2563eb'::text,
  pdf_table_header_color text DEFAULT '#2563eb'::text,
  pdf_option_text_color text DEFAULT '#f97316'::text,
  pdf_free_text_color text DEFAULT '#22c55e'::text,
  pdf_total_color text DEFAULT '#2563eb'::text,
  pdf_hide_prices boolean DEFAULT false,
  pdf_hide_descriptions_page boolean DEFAULT false,
  quotes_count integer DEFAULT 0,
  company_bank_name text,
  company_iban text,
  company_bic text,
  company_bank_account_holder text,
  preferred_payment_method text DEFAULT 'virement'::text,
  custom_vat_rate numeric DEFAULT 20,
  parent_user_id uuid,
  subscription_plan text DEFAULT 'free'::text NOT NULL,
  max_linked_users integer DEFAULT 1 NOT NULL,
  can_view_all_company_data boolean DEFAULT false NOT NULL,
  pdf_font_size_client_name integer DEFAULT 16,
  pdf_font_size_event_type integer DEFAULT 16,
  pdf_font_size_event_location integer DEFAULT 16,
  pdf_font_size_remarks integer DEFAULT 14,
  pdf_font_size_services_intro integer DEFAULT 14,
  pdf_font_size_services_details integer DEFAULT 14,
  pdf_font_size_conditions integer DEFAULT 12,
  has_completed_onboarding boolean DEFAULT false,
  default_vat_rate integer DEFAULT 20,
  cgv text,
  siret text,
  logo_url text
);

CREATE TABLE public.prospect_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  address text,
  service_address text,
  guest_count integer,
  event_type text,
  event_date date,
  message text,
  status text DEFAULT 'nouveau'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  owner_user_id uuid,
  user_token text,
  guest_count_children integer
);

CREATE TABLE public.purchase_order_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  purchase_order_id uuid NOT NULL,
  service_id uuid,
  item_name text NOT NULL,
  description text,
  quantity integer DEFAULT 1 NOT NULL,
  unit_price numeric DEFAULT 0 NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.purchase_orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id uuid NOT NULL,
  quote_id uuid NOT NULL,
  supplier_id uuid,
  po_number text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  order_date date DEFAULT CURRENT_DATE NOT NULL,
  expected_delivery_date date,
  assigned_to uuid,
  notes text,
  total_amount numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  attach_pdf_to_briefing boolean DEFAULT false NOT NULL
);

CREATE TABLE public.quote_folders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id uuid NOT NULL,
  parent_id uuid,
  name text NOT NULL,
  color text DEFAULT 'purple'::text NOT NULL,
  icon text DEFAULT 'folder'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.quote_photos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  quote_id uuid,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_url text NOT NULL,
  caption text,
  sort_order integer DEFAULT 0 NOT NULL,
  is_base_photo boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.quote_services (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quote_id uuid NOT NULL,
  service_id uuid NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  sort_order integer DEFAULT 0,
  is_option boolean DEFAULT false,
  is_free boolean DEFAULT false,
  cost_price numeric DEFAULT 0,
  custom_name text,
  custom_description text
);

CREATE TABLE public.quote_status_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quote_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid NOT NULL,
  changed_at timestamp with time zone DEFAULT now() NOT NULL,
  notes text
);

CREATE TABLE public.quote_template_services (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  template_id uuid NOT NULL,
  service_id uuid NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  unit_price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.quote_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  event_type text NOT NULL,
  guest_count integer NOT NULL,
  remarks text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  user_id uuid,
  base_template text DEFAULT 'standard'::text NOT NULL,
  accent_color text DEFAULT '#9c27b0'::text NOT NULL,
  header_note text,
  footer_note text,
  is_default boolean DEFAULT false NOT NULL,
  primary_color character varying(20) DEFAULT '#9c27b0'::character varying,
  font_family character varying(100) DEFAULT 'Georgia'::character varying,
  layout_type character varying(50) DEFAULT 'standard'::character varying
);

CREATE TABLE public.quotes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id uuid NOT NULL,
  client_name text NOT NULL,
  event_date date NOT NULL,
  event_type text NOT NULL,
  guest_count integer NOT NULL,
  remarks text,
  total_amount numeric(10,2) DEFAULT 0,
  status text DEFAULT 'draft'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  internal_notes text,
  customer_id uuid,
  name text,
  is_archived boolean DEFAULT false,
  total_cost_price numeric DEFAULT 0,
  event_status text DEFAULT 'en_cours'::text,
  team_arrival_time time without time zone,
  event_location text,
  quote_number text,
  edited_client_name text,
  edited_event_type text,
  edited_event_location text,
  edited_remarks text,
  edited_services_intro text,
  edited_services_details text,
  edited_conditions text,
  checklist jsonb DEFAULT '[]'::jsonb,
  images jsonb DEFAULT '[]'::jsonb,
  template text DEFAULT 'standard'::text,
  services jsonb DEFAULT '[]'::jsonb,
  client_first_name text,
  client_last_name text,
  client_email text,
  client_phone text,
  client_address text,
  client_type text DEFAULT 'particulier'::text,
  company_name text,
  contact_person_name text,
  vat_rate numeric DEFAULT 20,
  hide_price boolean DEFAULT false,
  user_id uuid,
  content_html text,
  event_materials jsonb DEFAULT '[]'::jsonb,
  selected_font character varying(100) DEFAULT 'Georgia'::character varying,
  selected_font_size integer,
  language text DEFAULT 'fr'::text,
  imported boolean DEFAULT false,
  imported_file_url text,
  imported_file_name text,
  guest_count_adults integer,
  guest_count_children integer,
  cover_page_config jsonb,
  photos_page_config jsonb,
  prospect_id text,
  extra_costs jsonb DEFAULT '[]'::jsonb,
  client_siret text,
  recipient_contact_email text,
  recipient_contact_phone text,
  recipient_contact_role text,
  recipient_contact_id text,
  internal_name text,
  folder_id uuid
);

CREATE TABLE public.rental_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quote_id uuid NOT NULL,
  material_name text NOT NULL,
  qty numeric DEFAULT 1,
  unit text,
  supplier_id uuid,
  price_per_unit numeric DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  source text DEFAULT 'manual'::text,
  ordered boolean DEFAULT false
);

CREATE TABLE public.service_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.service_ingredients (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  service_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  qty_per_person numeric DEFAULT 1 NOT NULL,
  unit text,
  created_at timestamp with time zone DEFAULT now(),
  quantity_per_guest numeric DEFAULT 0
);

CREATE TABLE public.service_materials (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  service_name text NOT NULL,
  material_name text NOT NULL,
  qty_per_unit numeric DEFAULT 1 NOT NULL,
  multiply_by text DEFAULT 'guest'::text NOT NULL,
  unit text DEFAULT 'unité'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.services (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  is_variable_price boolean DEFAULT false NOT NULL,
  cost_price numeric DEFAULT 0,
  category_id uuid,
  supplier_id uuid,
  parent_service_id uuid,
  internal_note text
);

CREATE TABLE public.software_updates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  version text NOT NULL,
  content text NOT NULL,
  published_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.stock_movements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  movement_type text NOT NULL,
  quantity numeric NOT NULL,
  reason text,
  event_id uuid,
  order_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.supplier_order_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL,
  unit_price numeric DEFAULT 0,
  received_quantity numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.supplier_orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  event_id uuid,
  status text DEFAULT 'draft'::text NOT NULL,
  total_amount numeric DEFAULT 0,
  notes text,
  ordered_at timestamp with time zone,
  received_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.suppliers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  notes text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  user_id uuid
);

CREATE TABLE public.support_ticket_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  message_id uuid,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size integer,
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.support_ticket_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  user_id uuid NOT NULL,
  message text NOT NULL,
  is_admin_message boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.support_tickets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  ticket_type support_ticket_type NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  status support_ticket_status DEFAULT 'Ouvert'::support_ticket_status NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.task_template_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  template_id uuid NOT NULL,
  name text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.task_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_library_photos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_url text NOT NULL,
  custom_name text NOT NULL,
  category text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_photo_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_prospect_tokens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  token text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  brochure_url text
);

ALTER TABLE public.briefing_tokens ADD CONSTRAINT briefing_tokens_pkey PRIMARY KEY (id);

ALTER TABLE public.collaborator_roles ADD CONSTRAINT collaborator_roles_pkey PRIMARY KEY (id);

ALTER TABLE public.collaborators ADD CONSTRAINT collaborators_pkey PRIMARY KEY (id);

ALTER TABLE public.customer_contacts ADD CONSTRAINT customer_contacts_pkey PRIMARY KEY (id);

ALTER TABLE public.customers ADD CONSTRAINT customers_pkey PRIMARY KEY (id);

ALTER TABLE public.demo_quote_services ADD CONSTRAINT demo_quote_services_pkey PRIMARY KEY (id);

ALTER TABLE public.demo_quotes ADD CONSTRAINT demo_quotes_pkey PRIMARY KEY (id);

ALTER TABLE public.demo_services ADD CONSTRAINT demo_services_pkey PRIMARY KEY (id);

ALTER TABLE public.demo_sessions ADD CONSTRAINT demo_sessions_pkey PRIMARY KEY (id);

ALTER TABLE public.devis_templates ADD CONSTRAINT devis_templates_pkey PRIMARY KEY (id);

ALTER TABLE public.event_attachment_visibility ADD CONSTRAINT event_attachment_visibility_pkey PRIMARY KEY (id);

ALTER TABLE public.event_attachments ADD CONSTRAINT event_attachments_pkey PRIMARY KEY (id);

ALTER TABLE public.event_extras ADD CONSTRAINT event_extras_pkey PRIMARY KEY (id);

ALTER TABLE public.event_ingredients ADD CONSTRAINT event_ingredients_pkey PRIMARY KEY (id);

ALTER TABLE public.event_personal_materials ADD CONSTRAINT event_personal_materials_pkey PRIMARY KEY (id);

ALTER TABLE public.event_tasks ADD CONSTRAINT event_tasks_pkey PRIMARY KEY (id);

ALTER TABLE public.event_team_assignments ADD CONSTRAINT event_team_assignments_pkey PRIMARY KEY (id);

ALTER TABLE public.extras ADD CONSTRAINT extras_pkey PRIMARY KEY (id);

ALTER TABLE public.ingredients ADD CONSTRAINT ingredients_pkey PRIMARY KEY (id);

ALTER TABLE public.invitation_links ADD CONSTRAINT invitation_links_pkey PRIMARY KEY (id);

ALTER TABLE public.invoice_services ADD CONSTRAINT invoice_services_pkey PRIMARY KEY (id);

ALTER TABLE public.invoice_status_history ADD CONSTRAINT invoice_status_history_pkey PRIMARY KEY (id);

ALTER TABLE public.invoices ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);

ALTER TABLE public.material_categories ADD CONSTRAINT material_categories_pkey PRIMARY KEY (id);

ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE public.personal_materials ADD CONSTRAINT personal_materials_pkey PRIMARY KEY (id);

ALTER TABLE public.prestation_categories ADD CONSTRAINT prestation_categories_pkey PRIMARY KEY (id);

ALTER TABLE public.prestation_subcategories ADD CONSTRAINT prestation_subcategories_pkey PRIMARY KEY (id);

ALTER TABLE public.prestations ADD CONSTRAINT prestations_pkey PRIMARY KEY (id);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.prospect_requests ADD CONSTRAINT prospect_requests_pkey PRIMARY KEY (id);

ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);

ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);

ALTER TABLE public.quote_folders ADD CONSTRAINT quote_folders_pkey PRIMARY KEY (id);

ALTER TABLE public.quote_photos ADD CONSTRAINT quote_photos_pkey PRIMARY KEY (id);

ALTER TABLE public.quote_services ADD CONSTRAINT quote_services_pkey PRIMARY KEY (id);

ALTER TABLE public.quote_status_history ADD CONSTRAINT quote_status_history_pkey PRIMARY KEY (id);

ALTER TABLE public.quote_template_services ADD CONSTRAINT quote_template_services_pkey PRIMARY KEY (id);

ALTER TABLE public.quote_templates ADD CONSTRAINT quote_templates_pkey PRIMARY KEY (id);

ALTER TABLE public.quotes ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);

ALTER TABLE public.rental_items ADD CONSTRAINT rental_items_pkey PRIMARY KEY (id);

ALTER TABLE public.service_categories ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);

ALTER TABLE public.service_ingredients ADD CONSTRAINT service_ingredients_pkey PRIMARY KEY (id);

ALTER TABLE public.service_materials ADD CONSTRAINT service_materials_pkey PRIMARY KEY (id);

ALTER TABLE public.services ADD CONSTRAINT services_pkey PRIMARY KEY (id);

ALTER TABLE public.software_updates ADD CONSTRAINT software_updates_pkey PRIMARY KEY (id);

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);

ALTER TABLE public.supplier_order_items ADD CONSTRAINT supplier_order_items_pkey PRIMARY KEY (id);

ALTER TABLE public.supplier_orders ADD CONSTRAINT supplier_orders_pkey PRIMARY KEY (id);

ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);

ALTER TABLE public.support_ticket_attachments ADD CONSTRAINT support_ticket_attachments_pkey PRIMARY KEY (id);

ALTER TABLE public.support_ticket_messages ADD CONSTRAINT support_ticket_messages_pkey PRIMARY KEY (id);

ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);

ALTER TABLE public.task_template_items ADD CONSTRAINT task_template_items_pkey PRIMARY KEY (id);

ALTER TABLE public.task_templates ADD CONSTRAINT task_templates_pkey PRIMARY KEY (id);

ALTER TABLE public.user_library_photos ADD CONSTRAINT user_library_photos_pkey PRIMARY KEY (id);

ALTER TABLE public.user_photo_categories ADD CONSTRAINT user_photo_categories_pkey PRIMARY KEY (id);

ALTER TABLE public.user_prospect_tokens ADD CONSTRAINT user_prospect_tokens_pkey PRIMARY KEY (id);

ALTER TABLE public.briefing_tokens ADD CONSTRAINT briefing_tokens_quote_id_collaborator_id_key UNIQUE (quote_id, collaborator_id);

ALTER TABLE public.briefing_tokens ADD CONSTRAINT briefing_tokens_token_key UNIQUE (token);

ALTER TABLE public.collaborators ADD CONSTRAINT collaborators_user_id_email_key UNIQUE (owner_user_id, email);

ALTER TABLE public.demo_sessions ADD CONSTRAINT demo_sessions_session_id_key UNIQUE (session_id);

ALTER TABLE public.event_attachment_visibility ADD CONSTRAINT event_attachment_visibility_attachment_id_collaborator_id_key UNIQUE (attachment_id, collaborator_id);

ALTER TABLE public.event_extras ADD CONSTRAINT event_extras_quote_id_extra_id_key UNIQUE (quote_id, extra_id);

ALTER TABLE public.event_personal_materials ADD CONSTRAINT event_personal_materials_quote_id_personal_material_id_key UNIQUE (quote_id, personal_material_id);

ALTER TABLE public.event_team_assignments ADD CONSTRAINT event_team_assignments_quote_id_collaborator_id_key UNIQUE (quote_id, collaborator_id);

ALTER TABLE public.extras ADD CONSTRAINT extras_access_token_key UNIQUE (access_token);

ALTER TABLE public.invitation_links ADD CONSTRAINT invitation_links_token_key UNIQUE (token);

ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);

ALTER TABLE public.quote_services ADD CONSTRAINT quote_services_quote_id_service_id_key UNIQUE (quote_id, service_id);

ALTER TABLE public.service_ingredients ADD CONSTRAINT service_ingredients_service_id_ingredient_id_key UNIQUE (service_id, ingredient_id);

ALTER TABLE public.software_updates ADD CONSTRAINT software_updates_version_key UNIQUE (version);

ALTER TABLE public.user_photo_categories ADD CONSTRAINT user_photo_categories_user_id_name_key UNIQUE (user_id, name);

ALTER TABLE public.user_prospect_tokens ADD CONSTRAINT user_prospect_tokens_token_key UNIQUE (token);

ALTER TABLE public.customers ADD CONSTRAINT check_entreprise_fields CHECK ((((customer_type = 'entreprise'::customer_type) AND (company_name IS NOT NULL) AND (contact_person_name IS NOT NULL)) OR (customer_type <> 'entreprise'::customer_type)));

ALTER TABLE public.customers ADD CONSTRAINT check_particulier_fields CHECK ((((customer_type = 'particulier'::customer_type) AND (first_name IS NOT NULL) AND (last_name IS NOT NULL)) OR (customer_type <> 'particulier'::customer_type)));

ALTER TABLE public.event_attachments ADD CONSTRAINT event_attachments_visibility_type_check CHECK ((visibility_type = ANY (ARRAY['all'::text, 'specific'::text])));

ALTER TABLE public.event_tasks ADD CONSTRAINT event_tasks_status_check CHECK ((status = ANY (ARRAY['a_faire'::text, 'fait'::text])));

ALTER TABLE public.notifications ADD CONSTRAINT notifications_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['prospect_request'::text, 'upcoming_event'::text, 'invoice_due'::text, 'support_ticket'::text, 'system_update'::text, 'task_reminder'::text, 'stock_alert'::text])));

ALTER TABLE public.profiles ADD CONSTRAINT profiles_custom_vat_rate_check CHECK (((custom_vat_rate >= (0)::numeric) AND (custom_vat_rate <= (100)::numeric)));

ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_type_check CHECK ((subscription_type = ANY (ARRAY['free'::text, 'premium'::text])));

ALTER TABLE public.prospect_requests ADD CONSTRAINT prospect_requests_status_check CHECK ((status = ANY (ARRAY['nouveau'::text, 'broch_envoyee'::text, 'devis_a_faire'::text, 'devis_envoye'::text, 'rdv_deg_a_venir'::text, 'rdv_deg_fait'::text, 'devis_final'::text, 'valide'::text, 'acompte'::text, 'paye'::text, 'refus_client'::text, 'refus_traiteur'::text])));

ALTER TABLE public.quote_services ADD CONSTRAINT quote_services_quantity_check CHECK ((quantity > 0));

ALTER TABLE public.quote_services ADD CONSTRAINT quote_services_unit_price_check CHECK ((unit_price >= (0)::numeric));

ALTER TABLE public.quotes ADD CONSTRAINT quotes_guest_count_check CHECK ((guest_count > 0));

ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check CHECK ((status = ANY (ARRAY['nouveau'::text, 'broch_envoyee'::text, 'devis_a_faire'::text, 'devis_envoye'::text, 'rdv_deg_a_venir'::text, 'rdv_deg_fait'::text, 'devis_final'::text, 'valide'::text, 'acompte'::text, 'paye'::text, 'refus_client'::text, 'refus_traiteur'::text])));

ALTER TABLE public.services ADD CONSTRAINT services_price_check CHECK ((price >= (0)::numeric));

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['in'::text, 'out'::text, 'adjust'::text])));

ALTER TABLE public.supplier_orders ADD CONSTRAINT supplier_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'received'::text, 'cancelled'::text])));

ALTER TABLE public.briefing_tokens ADD CONSTRAINT briefing_tokens_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES collaborators(id) ON DELETE CASCADE;

ALTER TABLE public.briefing_tokens ADD CONSTRAINT briefing_tokens_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

ALTER TABLE public.collaborators ADD CONSTRAINT collaborators_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.customer_contacts ADD CONSTRAINT customer_contacts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public.customers ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);

ALTER TABLE public.customers ADD CONSTRAINT customers_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.demo_quote_services ADD CONSTRAINT demo_quote_services_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES demo_quotes(id) ON DELETE CASCADE;

ALTER TABLE public.demo_quote_services ADD CONSTRAINT demo_quote_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES demo_services(id) ON DELETE CASCADE;

ALTER TABLE public.demo_quotes ADD CONSTRAINT demo_quotes_session_id_fkey FOREIGN KEY (session_id) REFERENCES demo_sessions(session_id) ON DELETE CASCADE;

ALTER TABLE public.demo_services ADD CONSTRAINT demo_services_session_id_fkey FOREIGN KEY (session_id) REFERENCES demo_sessions(session_id) ON DELETE CASCADE;

ALTER TABLE public.devis_templates ADD CONSTRAINT devis_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.event_attachment_visibility ADD CONSTRAINT event_attachment_visibility_attachment_id_fkey FOREIGN KEY (attachment_id) REFERENCES event_attachments(id) ON DELETE CASCADE;

ALTER TABLE public.event_attachment_visibility ADD CONSTRAINT event_attachment_visibility_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES collaborators(id) ON DELETE CASCADE;

ALTER TABLE public.event_attachments ADD CONSTRAINT event_attachments_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

ALTER TABLE public.event_attachments ADD CONSTRAINT event_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);

ALTER TABLE public.event_extras ADD CONSTRAINT event_extras_extra_id_fkey FOREIGN KEY (extra_id) REFERENCES extras(id) ON DELETE CASCADE;

ALTER TABLE public.event_extras ADD CONSTRAINT event_extras_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

ALTER TABLE public.event_ingredients ADD CONSTRAINT event_ingredients_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES ingredients(id);

ALTER TABLE public.event_ingredients ADD CONSTRAINT event_ingredients_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

ALTER TABLE public.event_ingredients ADD CONSTRAINT event_ingredients_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id);

ALTER TABLE public.event_personal_materials ADD CONSTRAINT event_personal_materials_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES collaborators(id) ON DELETE SET NULL;

ALTER TABLE public.event_personal_materials ADD CONSTRAINT event_personal_materials_personal_material_id_fkey FOREIGN KEY (personal_material_id) REFERENCES personal_materials(id) ON DELETE CASCADE;

ALTER TABLE public.event_personal_materials ADD CONSTRAINT event_personal_materials_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

ALTER TABLE public.event_tasks ADD CONSTRAINT event_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES collaborators(id) ON DELETE SET NULL;

ALTER TABLE public.event_tasks ADD CONSTRAINT event_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.event_tasks ADD CONSTRAINT event_tasks_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

ALTER TABLE public.event_team_assignments ADD CONSTRAINT event_team_assignments_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES collaborators(id) ON DELETE CASCADE;

ALTER TABLE public.event_team_assignments ADD CONSTRAINT event_team_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.event_team_assignments ADD CONSTRAINT event_team_assignments_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

ALTER TABLE public.extras ADD CONSTRAINT extras_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE public.ingredients ADD CONSTRAINT ingredients_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);

ALTER TABLE public.ingredients ADD CONSTRAINT ingredients_preferred_supplier_id_fkey FOREIGN KEY (preferred_supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE public.ingredients ADD CONSTRAINT ingredients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE public.invitation_links ADD CONSTRAINT invitation_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.invitation_links ADD CONSTRAINT invitation_links_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.users(id);

ALTER TABLE public.invoice_services ADD CONSTRAINT invoice_services_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

ALTER TABLE public.invoice_status_history ADD CONSTRAINT fk_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id);

ALTER TABLE public.invoice_status_history ADD CONSTRAINT invoice_status_history_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

ALTER TABLE public.invoices ADD CONSTRAINT invoices_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

ALTER TABLE public.prestation_categories ADD CONSTRAINT prestation_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.prestation_subcategories ADD CONSTRAINT prestation_subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES prestation_categories(id) ON DELETE CASCADE;

ALTER TABLE public.prestation_subcategories ADD CONSTRAINT prestation_subcategories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.prestations ADD CONSTRAINT prestations_category_id_fkey FOREIGN KEY (category_id) REFERENCES prestation_categories(id) ON DELETE SET NULL;

ALTER TABLE public.prestations ADD CONSTRAINT prestations_sub_category_id_fkey FOREIGN KEY (sub_category_id) REFERENCES prestation_subcategories(id) ON DELETE SET NULL;

ALTER TABLE public.prestations ADD CONSTRAINT prestations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_parent_user_id_fkey FOREIGN KEY (parent_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE public.prospect_requests ADD CONSTRAINT prospect_requests_user_token_fkey FOREIGN KEY (user_token) REFERENCES user_prospect_tokens(token);

ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;

ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id);

ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES collaborators(id);

ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id);

ALTER TABLE public.quote_folders ADD CONSTRAINT quote_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES quote_folders(id) ON DELETE CASCADE;

ALTER TABLE public.quote_photos ADD CONSTRAINT quote_photos_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

ALTER TABLE public.quote_services ADD CONSTRAINT quote_services_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

ALTER TABLE public.quote_services ADD CONSTRAINT quote_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;

ALTER TABLE public.quote_status_history ADD CONSTRAINT quote_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);

ALTER TABLE public.quote_status_history ADD CONSTRAINT quote_status_history_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

ALTER TABLE public.quote_template_services ADD CONSTRAINT quote_template_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;

ALTER TABLE public.quote_template_services ADD CONSTRAINT quote_template_services_template_id_fkey FOREIGN KEY (template_id) REFERENCES quote_templates(id) ON DELETE CASCADE;

ALTER TABLE public.quote_templates ADD CONSTRAINT quote_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE public.quotes ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.quotes ADD CONSTRAINT quotes_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES quote_folders(id) ON DELETE SET NULL;

ALTER TABLE public.quotes ADD CONSTRAINT quotes_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.quotes ADD CONSTRAINT quotes_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE public.rental_items ADD CONSTRAINT rental_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

ALTER TABLE public.rental_items ADD CONSTRAINT rental_items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE public.service_ingredients ADD CONSTRAINT service_ingredients_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE;

ALTER TABLE public.service_ingredients ADD CONSTRAINT service_ingredients_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;

ALTER TABLE public.service_ingredients ADD CONSTRAINT service_ingredients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.service_materials ADD CONSTRAINT service_materials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE public.services ADD CONSTRAINT services_category_id_fkey FOREIGN KEY (category_id) REFERENCES service_categories(id);

ALTER TABLE public.services ADD CONSTRAINT services_parent_service_id_fkey FOREIGN KEY (parent_service_id) REFERENCES services(id);

ALTER TABLE public.services ADD CONSTRAINT services_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id);

ALTER TABLE public.services ADD CONSTRAINT services_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.software_updates ADD CONSTRAINT software_updates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_event_id_fkey FOREIGN KEY (event_id) REFERENCES quotes(id) ON DELETE SET NULL;

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE;

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.supplier_order_items ADD CONSTRAINT supplier_order_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE;

ALTER TABLE public.supplier_order_items ADD CONSTRAINT supplier_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES supplier_orders(id) ON DELETE CASCADE;

ALTER TABLE public.supplier_orders ADD CONSTRAINT supplier_orders_event_id_fkey FOREIGN KEY (event_id) REFERENCES quotes(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_orders ADD CONSTRAINT supplier_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

ALTER TABLE public.supplier_orders ADD CONSTRAINT supplier_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE public.support_ticket_attachments ADD CONSTRAINT support_ticket_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES support_ticket_messages(id) ON DELETE CASCADE;

ALTER TABLE public.support_ticket_attachments ADD CONSTRAINT support_ticket_attachments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE;

ALTER TABLE public.support_ticket_attachments ADD CONSTRAINT support_ticket_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public.support_ticket_messages ADD CONSTRAINT support_ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE;

ALTER TABLE public.support_ticket_messages ADD CONSTRAINT support_ticket_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public.task_template_items ADD CONSTRAINT task_template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES task_templates(id) ON DELETE CASCADE;

ALTER TABLE public.user_library_photos ADD CONSTRAINT user_library_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_photo_categories ADD CONSTRAINT user_photo_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX idx_customer_contacts_customer ON public.customer_contacts USING btree (customer_id);

CREATE UNIQUE INDEX customers_email_owner_unique ON public.customers USING btree (email, owner_user_id);

CREATE UNIQUE INDEX customers_siret_owner_unique ON public.customers USING btree (siret_number, owner_user_id) WHERE (siret_number IS NOT NULL);

CREATE INDEX idx_customers_company_name ON public.customers USING btree (company_name) WHERE (customer_type = 'entreprise'::customer_type);

CREATE INDEX idx_customers_customer_type ON public.customers USING btree (customer_type);

CREATE INDEX idx_customers_email ON public.customers USING btree (email);

CREATE INDEX idx_customers_last_name ON public.customers USING btree (last_name) WHERE (customer_type = 'particulier'::customer_type);

CREATE INDEX idx_customers_user_id ON public.customers USING btree (owner_user_id);

CREATE INDEX idx_event_ingredients_quote_id ON public.event_ingredients USING btree (quote_id);

CREATE INDEX idx_prestation_categories_user ON public.prestation_categories USING btree (user_id);

CREATE INDEX idx_prestation_subcategories_cat ON public.prestation_subcategories USING btree (category_id);

CREATE INDEX idx_prestation_subcategories_user ON public.prestation_subcategories USING btree (user_id);

CREATE INDEX idx_prestations_category_id ON public.prestations USING btree (category_id);

CREATE INDEX idx_prestations_sub_category_id ON public.prestations USING btree (sub_category_id);

CREATE INDEX idx_profiles_company_siret ON public.profiles USING btree (company_siret);

CREATE INDEX idx_quote_folders_owner ON public.quote_folders USING btree (owner_user_id);

CREATE INDEX idx_quote_folders_parent ON public.quote_folders USING btree (parent_id);

CREATE INDEX idx_quote_photos_quote_id ON public.quote_photos USING btree (quote_id);

CREATE INDEX idx_quote_photos_user_id ON public.quote_photos USING btree (user_id);

CREATE INDEX idx_quote_services_sort_order ON public.quote_services USING btree (quote_id, sort_order);

CREATE INDEX idx_quotes_customer_id ON public.quotes USING btree (customer_id);

CREATE INDEX idx_quotes_folder ON public.quotes USING btree (folder_id);

CREATE INDEX idx_services_category_id ON public.services USING btree (category_id);

CREATE INDEX idx_services_parent_service_id ON public.services USING btree (parent_service_id);

CREATE INDEX idx_software_updates_published_at ON public.software_updates USING btree (published_at DESC);

CREATE INDEX idx_stock_movements_event ON public.stock_movements USING btree (event_id);

CREATE INDEX idx_stock_movements_ingredient ON public.stock_movements USING btree (ingredient_id);

CREATE INDEX idx_stock_movements_user ON public.stock_movements USING btree (user_id);

CREATE INDEX idx_supplier_order_items_ingredient ON public.supplier_order_items USING btree (ingredient_id);

CREATE INDEX idx_supplier_order_items_order ON public.supplier_order_items USING btree (order_id);

CREATE INDEX idx_supplier_orders_event ON public.supplier_orders USING btree (event_id);

CREATE INDEX idx_supplier_orders_supplier ON public.supplier_orders USING btree (supplier_id);

CREATE INDEX idx_supplier_orders_user ON public.supplier_orders USING btree (user_id);
